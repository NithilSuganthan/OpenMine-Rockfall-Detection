"""POST /api/predict — sensor fusion + LSTM trend + optional vision inference.

Persists every prediction and broadcasts it to the Digital Twin over the
shared WebSocket hub (and optionally MQTT).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from ..core.websocket import manager
from ..database.models import Prediction
from ..database.session import get_db
from ..ml.inference import PredictionError, PredictionService
from ..schemas.predict import PredictRequest, PredictResponse

router = APIRouter(prefix="/api", tags=["predict"])


def get_service(request: Request) -> PredictionService:
    return request.app.state.ml


@router.post("/predict", response_model=PredictResponse)
async def predict(
    body: PredictRequest,
    request: Request,
    service: PredictionService = Depends(get_service),
    db: Session = Depends(get_db),
):
    try:
        result = await run_in_threadpool(
            service.predict, body.sensor_packet, body.trend_window, body.image
        )
    except (ValueError, PredictionError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.add(
        Prediction(
            score=result["risk_score_0_to_10"],
            tier=result["tier"],
            confidence=result["confidence"],
            recommendation=result["recommendation"],
            sensor_packet=body.sensor_packet,
            trend_window=body.trend_window,
            vision_label=result["vision_label"],
            vision_confidence=result["inputs"]["vision_severe_confidence"],
        )
    )
    db.commit()

    payload = {
        "type": "prediction",
        "data": {
            "score": result["risk_score_0_to_10"],
            "tier": result["tier"],
            "confidence": result["confidence"],
            "recommendation": result["recommendation"],
            "at": datetime.now(timezone.utc).isoformat(),
        },
    }
    await manager.broadcast(payload)
    mqtt = getattr(request.app.state, "mqtt", None)
    if mqtt is not None:
        mqtt.publish(payload)

    return PredictResponse(
        score=result["risk_score_0_to_10"],
        tier=result["tier"],
        confidence=result["confidence"],
        recommendation=result["recommendation"],
    )
