"""
mongo_client.py — MongoDB queries for compass-ml-service (demand-price-service).

ACTUAL MongoDB SCHEMA (read from Atlas):
────────────────────────────────────────

ActualMonthlyProduction collection:
  - landownerId      : ObjectId
  - month            : string  (YYYY-MM)
  - production_volume: number  ← this farm's actual production
  - season           : string  ("Maha" or "Yala")
  36 records exist. NO demand field. NO price field.

deals collection:
  - landownerId, distributorId, offerId: ObjectId
  - quantity: number
  - pricePerKilo: number
  - status: string ("CLOSED" = completed sale)
  - createdAt, acceptedAt: ISODate
  Only 9 test records — NOT enough for yield ratio calculation.

FALLBACK STRATEGY:
──────────────────
Since demand_bags does not exist in ActualMonthlyProduction, use government
regional dataset fallback yield ratios from 168 months of Puttalam data:
  Maha season (Oct-Mar): 0.1027
  Yala season (Apr-Sep): 0.0874

For price: fall back to price_sarimax_history.pkl immediately.
Do not attempt to read price from MongoDB until platform goes live.
See SCHEMA_MIGRATION.md for the full migration plan.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pymongo
from pymongo import MongoClient as PyMongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

# ── Regional fallback yield ratios (Puttalam 168-month dataset) ───────────────
# These are used when demand_bags is not available in ActualMonthlyProduction.
REGIONAL_YIELD_RATIO_MAHA = 0.1027  # Oct-Mar
REGIONAL_YIELD_RATIO_YALA = 0.0874  # Apr-Sep
REGIONAL_YIELD_RATIO_TRANSITION = 0.0951  # Average of Maha and Yala
MAHA_MONTHS = {10, 11, 12, 1, 2, 3}

logger = logging.getLogger(__name__)


class MongoSchemaError(Exception):
    """Raised when a required field is missing from the MongoDB collection."""
    pass


class MongoClient:
    """
    Thin wrapper around pymongo for compass-ml-service.

    Collections used:
      - actualmonthlyproductions  (Mongoose default: lowercase + pluralised class name)
      - saltpricehistories        (planned — see SCHEMA_MIGRATION.md)
    """

    # Mongoose pluralises and lowercases model names by default.
    PRODUCTION_COLLECTION = "actualmonthlyproductions"
    # Price history collection — does not exist yet, see SCHEMA_MIGRATION.md.
    PRICE_COLLECTION = "saltpricehistories"
    # Output store for price predictions written after each forecast call.
    PRICE_PREDICTIONS_COLLECTION = "pricepredictions"

    def __init__(self, mongo_uri: str, db_name: str = "test") -> None:
        self._uri = mongo_uri
        self._db_name = db_name
        self._client: Optional[PyMongoClient] = None
        self._db = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def connect(self) -> None:
        """Create a pymongo client and verify connectivity."""
        self._client = PyMongoClient(
            self._uri,
            serverSelectionTimeoutMS=5_000,
            connectTimeoutMS=5_000,
            socketTimeoutMS=10_000,
        )
        self.ping()  # fail fast
        # Infer DB name from the URI if present, else fall back to self._db_name.
        parsed_db = self._client.get_default_database(default=None)
        self._db = parsed_db if parsed_db is not None else self._client[self._db_name]
        logger.info("MongoDB connected — database: %s", self._db.name)

    def close(self) -> None:
        if self._client:
            self._client.close()

    def ping(self) -> bool:
        """Return True if MongoDB is reachable, False otherwise."""
        if self._client is None:
            return False
        try:
            self._client.admin.command("ping")
            return True
        except (ConnectionFailure, OperationFailure, Exception):
            return False

    # ── Production / Yield history ────────────────────────────────────────────

    def get_yield_ratio_history(self, months: int = 36) -> List[Dict[str, Any]]:
        """
        Fetch the last `months` records from ActualMonthlyProduction.

        Returns a list of dicts with keys:
          date             : datetime (first day of month)
          production_bags  : float  (mapped from production_volume)
          demand_bags      : float | None  (NOT in current schema → None)
          season           : str  (computed from month, not from stored field)

        If demand_bags is None for all records the caller should use the
        regional fallback yield ratios (REGIONAL_YIELD_RATIO_MAHA/YALA).
        """
        if self._db is None:
            logger.warning("MongoDB not connected — returning empty yield history.")
            return []

        col = self._db[self.PRODUCTION_COLLECTION]
        # Query actual field names: month, production_volume
        # Note: we compute season from month, not from stored "season" field
        cursor = (
            col.find({}, {"month": 1, "production_volume": 1, "demand_kg": 1, "_id": 0})
            .sort("month", pymongo.DESCENDING)
            .limit(months)
        )

        results = []
        for doc in cursor:
            month_str: str = doc.get("month", "")
            try:
                dt = datetime.strptime(month_str, "%Y-%m").replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                logger.warning("Skipping doc with invalid month format: %s", month_str)
                continue

            production_volume = doc.get("production_volume")
            if production_volume is None:
                logger.warning(
                    "Field 'production_volume' missing from ActualMonthlyProduction document. "
                    f"Document month: {month_str}. Skipping."
                )
                continue

            # Compute season from month (don't rely on stored "season" field)
            month_num = dt.month
            computed_season = "maha" if month_num in MAHA_MONTHS else "yala"

            # demand_kg will be added in Phase 2 migration — currently None
            demand_kg = doc.get("demand_kg", None)

            results.append(
                {
                    "date": dt,
                    "production_bags": float(production_volume),
                    "demand_bags": float(demand_kg) if demand_kg is not None else None,
                    "season": computed_season,
                }
            )

        return results

    # ── Price history (for SARIMAX exog) ─────────────────────────────────────

    def get_price_history(self, months: int = 13) -> List[Dict[str, Any]]:
        """
        Fetch the last `months` records from the price history collection.

        SCHEMA NOTE: price_mean does NOT exist in ActualMonthlyProduction.
        This collection (saltpricehistories) does not exist yet.
        The service falls back to price_sarimax_history.pkl immediately.
        price_mean will be added when platform goes live and deals accumulate.
        See SCHEMA_MIGRATION.md for the migration plan.

        Returns a list of dicts with keys:
          date                  : datetime
          price_mean            : float
          total_production_bags : float
          is_maha_season        : int (0 or 1)

        Returns [] if the collection does not exist or contains no data.
        """
        if self._db is None:
            logger.warning("MongoDB not connected — returning empty price history.")
            return []

        col = self._db[self.PRICE_COLLECTION]
        try:
            cursor = (
                col.find(
                    {},
                    {
                        "month": 1,
                        "price_mean": 1,
                        "total_production_bags": 1,
                        "is_maha_season": 1,
                        "_id": 0,
                    },
                )
                .sort("month", pymongo.DESCENDING)
                .limit(months)
            )

            results = []
            for doc in cursor:
                month_str = doc.get("month", "")
                try:
                    dt = datetime.strptime(month_str, "%Y-%m").replace(
                        tzinfo=timezone.utc
                    )
                except ValueError:
                    logger.warning("Skipping price history doc: invalid month %s", month_str)
                    continue

                price_mean = doc.get("price_mean")
                if price_mean is None:
                    raise MongoSchemaError(
                        f"Field 'price_mean' missing in price history document month={month_str}."
                    )

                results.append(
                    {
                        "date": dt,
                        "price_mean": float(price_mean),
                        "total_production_bags": float(doc.get("total_production_bags", 0.0)),
                        "is_maha_season": int(doc.get("is_maha_season", 0)),
                    }
                )

            return results

        except OperationFailure as exc:
            logger.warning("Price history collection query failed: %s", exc)
            return []
        except MongoSchemaError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("Unexpected error querying price history: %s", exc)
            return []

    # ── Price predictions (write-after-forecast) ───────────────────────────

    def write_price_prediction(self, doc: dict) -> None:
        """
        Insert one price prediction document into the pricepredictions collection.

        Expected doc keys:
          forecast_date        : str  ("YYYY-MM-DD")  — date forecast was run
          month                : str  ("YYYY-MM")     — target month being forecast
          horizon_months       : int  (1 or 2)
          predicted_lkr_per_bag: float
          lower_95             : float
          upper_95             : float
          model_version        : str
          expected_mape_pct    : float | None

        This method NEVER raises — failures are logged as warnings so the
        API response is not affected.
        """
        if self._db is None:
            logger.warning(
                "MongoDB not connected — skipping pricepredictions write for month %s.",
                doc.get("month"),
            )
            return
        try:
            col = self._db[self.PRICE_PREDICTIONS_COLLECTION]
            payload = {
                **doc,
                "created_at": datetime.now(timezone.utc),
            }
            col.insert_one(payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to write to pricepredictions (non-fatal): %s", exc
            )
