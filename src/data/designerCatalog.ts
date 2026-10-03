import type { LucideIcon } from 'lucide-react';
import {
  Activity, Antenna, Cctv, Droplets, Gauge, RadioTower, Siren, Wifi, Wind,
} from 'lucide-react';
import type { DesignerCategory, DesignerComponentType } from './designerTypes';

export interface ComponentSpec {
  type: DesignerComponentType;
  label: string;
  short: string;
  icon: LucideIcon;
  color: string;
  category: DesignerCategory;
  description: string;
  defaultBattery: number;
  defaultRate: number;
  rateOptions: number[];
  baseHeight: number; // vertical extent of the model
  coverageRadius: number; // sensing coverage for scoring
  maxLinks: number; // recommended connection count
}

export const COMPONENT_SPECS: Record<DesignerComponentType, ComponentSpec> = {
  'monitoring-pole': {
    type: 'monitoring-pole',
    label: 'Monitoring Pole',
    short: 'POLE',
    icon: Antenna,
    color: '#22d3ee',
    category: 'sensing',
    description: 'Mounting structure for field sensors',
    defaultBattery: 92,
    defaultRate: 5,
    rateOptions: [1, 2, 5, 10, 30],
    baseHeight: 3.4,
    coverageRadius: 15,
    maxLinks: 4,
  },
  'tilt-sensor': {
    type: 'tilt-sensor',
    label: 'MPU6050 Tilt Sensor',
    short: 'MPU6050',
    icon: Gauge,
    color: '#38bdf8',
    category: 'sensing',
    description: 'Measures slope inclination via accelerometer/gyroscope',
    defaultBattery: 88,
    defaultRate: 1,
    rateOptions: [0.5, 1, 2, 5, 10],
    baseHeight: 1.6,
    coverageRadius: 14,
    maxLinks: 3,
  },
  geophone: {
    type: 'geophone',
    label: 'Geophone',
    short: 'GEO',
    icon: Activity,
    color: '#fb923c',
    category: 'sensing',
    description: 'Measures blasting vibration and ground movement',
    defaultBattery: 85,
    defaultRate: 0.5,
    rateOptions: [0.5, 1, 2, 5],
    baseHeight: 0.9,
    coverageRadius: 16,
    maxLinks: 3,
  },
  'soil-moisture': {
    type: 'soil-moisture',
    label: 'Soil Moisture Sensor',
    short: 'MOIST',
    icon: Droplets,
    color: '#34d399',
    category: 'sensing',
    description: 'Measures soil moisture content in the slope material',
    defaultBattery: 86,
    defaultRate: 2,
    rateOptions: [0.5, 1, 2, 5, 10],
    baseHeight: 0.8,
    coverageRadius: 8,
    maxLinks: 3,
  },
  'weather-station': {
    type: 'weather-station',
    label: 'BME280 Weather Sensor',
    short: 'BME280',
    icon: Wind,
    color: '#7dd3fc',
    category: 'sensing',
    description: 'Measures temperature, humidity and barometric pressure',
    defaultBattery: 95,
    defaultRate: 30,
    rateOptions: [5, 10, 30, 60],
    baseHeight: 3.2,
    coverageRadius: 10,
    maxLinks: 3,
  },
  camera: {
    type: 'camera',
    label: 'ESP32-CAM',
    short: 'CAM',
    icon: Cctv,
    color: '#e2e8f0',
    category: 'sensing',
    description: 'Captures crack images for visual slope monitoring',
    defaultBattery: 90,
    defaultRate: 2,
    rateOptions: [1, 2, 5, 10],
    baseHeight: 2.6,
    coverageRadius: 12,
    maxLinks: 3,
  },
  gateway: {
    type: 'gateway',
    label: 'Edge Gateway',
    short: 'GATEWAY',
    icon: RadioTower,
    color: '#22d3ee',
    category: 'infrastructure',
    description: 'Raspberry Pi / NVIDIA Jetson — collects LoRa traffic',
    defaultBattery: 100,
    defaultRate: 1,
    rateOptions: [1, 2, 5],
    baseHeight: 6.5,
    coverageRadius: 26,
    maxLinks: 14,
  },
  'relay-node': {
    type: 'relay-node',
    label: 'LoRa Relay Node',
    short: 'RLY',
    icon: Wifi,
    color: '#a78bfa',
    category: 'infrastructure',
    description: 'Extends LoRa mesh coverage across the pit',
    defaultBattery: 82,
    defaultRate: 2,
    rateOptions: [1, 2, 5],
    baseHeight: 2.2,
    coverageRadius: 22,
    maxLinks: 6,
  },
  'emergency-siren': {
    type: 'emergency-siren',
    label: 'Emergency Siren',
    short: 'ALM',
    icon: Siren,
    color: '#ef4444',
    category: 'alert',
    description: 'Warning device for evacuation and alerting',
    defaultBattery: 98,
    defaultRate: 60,
    rateOptions: [10, 30, 60],
    baseHeight: 2.8,
    coverageRadius: 0,
    maxLinks: 3,
  },
};

export const COMPONENT_ORDER: DesignerComponentType[] = [
  'monitoring-pole',
  'tilt-sensor',
  'geophone',
  'soil-moisture',
  'weather-station',
  'camera',
  'gateway',
  'relay-node',
  'emergency-siren',
];

export const SENSING_TYPES: DesignerComponentType[] = [
  'monitoring-pole',
  'tilt-sensor',
  'geophone',
  'soil-moisture',
  'weather-station',
  'camera',
];
