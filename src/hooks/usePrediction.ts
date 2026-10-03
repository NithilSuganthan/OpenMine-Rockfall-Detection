import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  buildSensorPacket,
  buildTrendWindow,
  getLatestPrediction,
  predict,
  setLatestPrediction,
  subscribeLatestPrediction,
  type PredictionResult,
} from '../services/predictionService';

export interface UsePredictionResult {
  prediction: PredictionResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Live ML prediction for the current sensor state.
 * All consumers share one cached result (see predictionService cache);
 * refresh() triggers a backend call and updates every subscriber.
 */
export function usePrediction(): UsePredictionResult {
  const { sensors, liveSeries } = useApp();
  const [prediction, setPrediction] = useState<PredictionResult | null>(getLatestPrediction());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => subscribeLatestPrediction(() => setPrediction(getLatestPrediction())), []);

  const sensorsRef = useRef(sensors);
  const seriesRef = useRef(liveSeries);
  useEffect(() => { sensorsRef.current = sensors; }, [sensors]);
  useEffect(() => { seriesRef.current = liveSeries; }, [liveSeries]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await predict(
        buildSensorPacket(sensorsRef.current),
        buildTrendWindow(seriesRef.current),
      );
      setLatestPrediction(result);
      setPrediction(result);
    } catch {
      setError('Prediction service unavailable');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  return { prediction, loading, error, refresh };
}
