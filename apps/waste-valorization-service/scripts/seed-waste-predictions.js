/*
Seed script for waste_predictions collection.
Usage:
  MONGO_URI="mongodb://..." node scripts/seed-waste-predictions.js --start=2025-03-01 --end=2026-02-28 --countPerDay=1

Defaults: uses MONGO_URI from env or the app default, inserts one record per day between start and end.
*/

const mongoose = require('mongoose');
const { argv } = require('process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

(async function main(){
  const args = yargs(hideBin(argv))
    .option('start', { type: 'string', default: null })
    .option('end', { type: 'string', default: null })
    .option('countPerDay', { type: 'number', default: 1 })
    .option('drop', { type: 'boolean', default: false })
    .argv;

  const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/brinex?appName=Cluster0';

  try {
    await mongoose.connect(MONGO_URI, { dbName: undefined });
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const coll = db.collection('waste_predictions');

    if (args.drop) {
      await coll.deleteMany({});
      console.log('Dropped existing documents in waste_predictions');
    }

    const startDate = args.start ? new Date(args.start) : (function(){ const d=new Date(); d.setDate(d.getDate()-90); return d; })();
    const endDate = args.end ? new Date(args.end) : new Date();

    // normalize
    startDate.setHours(0,0,0,0);
    endDate.setHours(0,0,0,0);

    if (startDate > endDate) {
      throw new Error('start date must be <= end date');
    }

    const docs = [];
    const rng = seedRandom(12345);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate()+1)) {
      const dateStr = d.toISOString().split('T')[0];
      for (let i=0;i<args.countPerDay;i++) {
        const production_volume = Math.round(40000 + rng()*40000); // 40k-80k
        const rain_sum = parseFloat((50 + rng()*300).toFixed(2));
        const temperature_mean = parseFloat((24 + rng()*8).toFixed(2));
        const humidity_mean = parseFloat((60 + rng()*30).toFixed(2));
        const wind_speed_mean = parseFloat((5 + rng()*20).toFixed(2));

        const totalWaste = Math.round(production_volume * (0.04 + rng()*0.02));

        const doc = {
          timestamp: new Date(),
          prediction_date: dateStr,
          input_parameters: {
            production_volume,
            rain_sum,
            temperature_mean,
            humidity_mean,
            wind_speed_mean,
            month: d.getMonth()+1,
          },
          prediction_result: {
            Total_Waste_kg: totalWaste,
            Solid_Waste_Limestone_kg: Math.round(totalWaste*0.21),
            Solid_Waste_Gypsum_kg: Math.round(totalWaste*0.29),
            Solid_Waste_Industrial_Salt_kg: Math.round(totalWaste*0.14),
            Liquid_Waste_Bittern_Liters: Math.round((totalWaste*0.26)/1.2),
            Potential_Epsom_Salt_kg: Math.round(totalWaste*0.04),
            Potential_Potash_kg: Math.round(totalWaste*0.028),
            Potential_Magnesium_Oil_Liters: Math.round((totalWaste*0.015)/1.1),
          },
          forecast_result: {
            total_waste_kg: totalWaste,
            solid_waste_limestone_kg: Math.round(totalWaste*0.21),
            solid_waste_gypsum_kg: Math.round(totalWaste*0.29),
            solid_waste_industrial_salt_kg: Math.round(totalWaste*0.14),
            liquid_waste_bittern_liters: Math.round((totalWaste*0.26)/1.2),
            potential_epsom_salt_kg: Math.round(totalWaste*0.04),
            potential_potash_kg: Math.round(totalWaste*0.028),
            potential_magnesium_oil_liters: Math.round((totalWaste*0.015)/1.1),
            model_version: 'dummy-v1',
            confidence: parseFloat((0.75 + rng()*0.2).toFixed(2)),
            Total_Waste_kg: totalWaste,
            _fetched_parameters: {
              production_volume,
              rain_sum,
              temperature_mean,
              humidity_mean,
              wind_speed_mean,
              month: d.getMonth()+1,
              source_date: dateStr,
            }
          },
          metadata: {
            event_type: 'WASTE/FORECAST',
            processor_version: 'seed-script-1',
            request_id: `seed-${dateStr}-${i}`,
          }
        };

        docs.push(doc);
      }
    }

    if (docs.length === 0) {
      console.log('No documents to insert');
      process.exit(0);
    }

    const res = await coll.insertMany(docs);
    console.log(`Inserted ${res.insertedCount} documents into waste_predictions`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed data', err);
    process.exit(1);
  }
})();

// simple seeded RNG
function seedRandom(seed){
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return function(){
    x = x * 16807 % 2147483647;
    return (x - 1) / 2147483646;
  }
}
