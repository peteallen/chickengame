export const environment = {
  plot: {
    widthRatio: 0.88,
    depthRatio: 0.48,
    backScale: 0.62,
    baseFromBottom: 0.28,
  },
  fence: {
    offset: 18,
    postSpacing: 26,
    postWidth: 8,
    postHeight: 52,
    railGap: 18,
    viewportPaddingX: 40,
    viewportPaddingY: 18,
    minGroundGap: 20,
  },
  field: {
    padding: 48,
    // Ratio of viewport height reserved for sky (e.g., 0.25 ≈ horizon 3/4 up the page)
    horizonRatio: 0.25,
  },
  constraints: {
    defaultBehavior: 'clamp',
    bounceDamping: 0.72,
    clampVelocityMultiplier: 0,
  },
} as const;

export type EnvironmentConfig = typeof environment;
