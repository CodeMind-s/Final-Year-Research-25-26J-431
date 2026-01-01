import grpc
from concurrent import futures
import sys
import os
from dotenv import load_dotenv

# Add the generated directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'generated'))

try:
    # Import generated gRPC code
    import seller_recommendations_pb2
    import seller_recommendations_pb2_grpc
    proto_loaded = True
except ImportError:
    print("Warning: Generated proto files not found. Please run generate_proto.bat/sh first.")
    proto_loaded = False

# Import the ML predictor
try:
    from ml_predictor import SellerRecommendationPredictor
except ImportError:
    print("Warning: ml_predictor not found in the same directory")
    SellerRecommendationPredictor = None

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

load_dotenv()


if proto_loaded:
    class SellerRecommendationServicer(seller_recommendations_pb2_grpc.SellerRecommendationServiceServicer):
        def __init__(self):
            self.predictor = SellerRecommendationPredictor() if SellerRecommendationPredictor else None
            logger.info("Seller Recommendation Service initialized")

        def GetSellerRecommendations(self, request, context):
            """Get seller recommendations based on production parameters"""
            try:
                logger.info(f"Received recommendation request for {request.total_production_bags} bags")
                
                if not self.predictor:
                    context.set_code(grpc.StatusCode.INTERNAL)
                    context.set_details('Prediction service not initialized')
                    return seller_recommendations_pb2.RecommendationResponse(status='error')
                
                # Prepare input data
                input_data = {
                    'total_production_bags': request.total_production_bags,
                    'price_per_bag': request.price_per_bag,
                    'area_sqft': request.area_sqft,
                    'season': request.season,
                    'date': request.date if request.date else None
                }
                
                # Get top_k parameter (default to 5)
                top_k = request.top_k if request.top_k > 0 else 5
                
                # Get predictions from ML model
                result = self.predictor.predict_sellers(input_data, top_k=top_k)
                
                # Convert result to protobuf response
                return self._convert_to_proto_response(result)
                
            except Exception as e:
                logger.error(f"Error during prediction: {str(e)}", exc_info=True)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(str(e))
                return seller_recommendations_pb2.RecommendationResponse(status='error')

        def LearnFromDeal(self, request, context):
            """Update model statistics after a deal is completed"""
            try:
                logger.info(f"Received learning request for seller {request.seller_id}")
                
                if not self.predictor:
                    context.set_code(grpc.StatusCode.INTERNAL)
                    context.set_details('Prediction service not initialized')
                    return seller_recommendations_pb2.LearningResponse(status='error')
                
                # Prepare deal data
                deal_data = {
                    'seller_id': request.seller_id,
                    'price_per_bag': request.price_per_bag,
                    'total_production_bags': request.total_production_bags,
                    'area_sqft': request.area_sqft,
                    'season': request.season,
                    'date': request.date if request.date else None
                }
                
                # Update model with deal data
                result = self.predictor.learn_from_deal(deal_data)
                
                # Convert result to protobuf response
                return seller_recommendations_pb2.LearningResponse(
                    status=result['status'],
                    update_type=result['update_type'],
                    seller_id=result['seller_id'],
                    updated_stats=seller_recommendations_pb2.UpdatedStats(
                        avg_price=result['updated_stats']['avg_price'],
                        median_production=result['updated_stats']['median_production']
                    ),
                    timestamp=result['timestamp']
                )
                
            except Exception as e:
                logger.error(f"Error during learning: {str(e)}", exc_info=True)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(str(e))
                return seller_recommendations_pb2.LearningResponse(status='error')

        def _convert_to_proto_response(self, result):
            """Convert dictionary result to protobuf RecommendationResponse"""
            # Convert recommendations
            recommendations = []
            for rec in result['recommendations']:
                recommendations.append(seller_recommendations_pb2.SellerRecommendation(
                    seller_id=rec['seller_id'],
                    confidence=rec['confidence'],
                    rank=rec['rank']
                ))
            
            # Build the complete response
            return seller_recommendations_pb2.RecommendationResponse(
                status=result['status'],
                recommendations=recommendations,
                input_summary=seller_recommendations_pb2.InputSummary(
                    production_bags=result['input_summary']['production_bags'],
                    asking_price=result['input_summary']['asking_price'],
                    area_sqft=result['input_summary']['area_sqft'],
                    season=result['input_summary']['season'],
                    date=result['input_summary']['date']
                ),
                timestamp=result['timestamp']
            )


def serve():
    if not proto_loaded:
        print("Cannot start server: Proto files not generated")
        print("Please run: generate_proto.bat (Windows) or generate_proto.sh (Linux/Mac)")
        return
    
    port = os.getenv('GRPC_PORT', '50059')
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    
    seller_recommendations_pb2_grpc.add_SellerRecommendationServiceServicer_to_server(
        SellerRecommendationServicer(), server
    )
    
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    
    logger.info(f'Compass ML 1 Service (Seller Recommendations) is running on gRPC port {port}')
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info('Shutting down...')
        server.stop(0)


if __name__ == '__main__':
    serve()
