export type RecordedDataPoint = {
  blobs?: ((ArrayBuffer | string) | null)[];
  doubles?: number[];
  indexes?: ((ArrayBuffer | string) | null)[];
};

/**
 * Minimal Analytics Engine stand-in for Worker tests.
 */
export function createMemoryAnalytics(): {
  points: RecordedDataPoint[];
  dataset: AnalyticsEngineDataset;
} {
  const points: RecordedDataPoint[] = [];
  return {
    points,
    dataset: {
      writeDataPoint(event?: AnalyticsEngineDataPoint) {
        if (event) {
          points.push({
            blobs: event.blobs,
            doubles: event.doubles,
            indexes: event.indexes,
          });
        }
      },
    },
  };
}
