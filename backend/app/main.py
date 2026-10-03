"""RockSafe Digital Twin backend — FastAPI application.

Lifespan: creates tables, loads the ML models once (PredictionService) and
starts the optional MQTT publisher. Exposes POST /api/predict and the
/ws WebSocket hub consumed by the Digital Twin frontend.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api.predict import router as predict_router
from .core.config import settings
from .core.websocket import manager
from .database.session import Base, engine
from .ml.inference import PredictionService
from .mqtt.publisher import MqttPublisher


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    service = PredictionService(settings.model_dir)
    service.start()
    app.state.ml = service

    publisher = MqttPublisher(settings.mqtt_url, settings.mqtt_topic) if settings.mqtt_url else None
    if publisher is not None:
        publisher.start()
    app.state.mqtt = publisher

    yield

    if publisher is not None:
        publisher.stop()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.app_name}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
