import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

const CHICK_METRICS = {
  referenceWidth: 120,
  shadow: { width: 82, height: 26, offsetY: 30 },
  feet: {
    groundY: 6,
    strideRange: 14,
    liftRange: 12,
    spacing: 28,
  },
  body: {
    width: 96,
    height: 76,
    offset: { x: -8, y: -40 },
  },
  head: {
    radius: 32,
    offset: { x: 34, y: -70 },
  },
  wing: {
    width: 54,
    height: 34,
    offset: { x: -6, y: -18 },
  },
  beak: {
    length: 24,
    thickness: 14,
    offset: { x: 50, y: -52 },
  },
  eye: {
    radius: 6,
    highlight: 2,
    offset: { x: 42, y: -60 },
  },
  crest: {
    width: 28,
    height: 16,
    offset: { x: 20, y: -82 },
  },
  tail: {
    width: 30,
    height: 32,
    offset: { x: -34, y: -30 },
  },
} as const;

export type ChickPoseState = {
  bodyLean: number;
  bodyLift: number;
  hop: number;
  headTilt: number;
  headBob: number;
  headForward: number;
  wingLift: number;
  wingSpread: number;
  tailLift: number;
  stride: number;
  frontFootLift: number;
  backFootLift: number;
  beakOpen: number;
};

export type ChickPose = Partial<ChickPoseState>;

export type ChickFacing = 'left' | 'right';

const BASE_SCALE = 0.45;

export const CHICK_IDLE_POSE: ChickPoseState = {
  bodyLean: -0.04,
  bodyLift: -2,
  hop: 0,
  headTilt: 0.2,
  headBob: -2,
  headForward: 0,
  wingLift: 0,
  wingSpread: 0,
  tailLift: 0.02,
  stride: 0,
  frontFootLift: 0,
  backFootLift: 0,
  beakOpen: 0,
} as const;

export type Chick = {
  view: Container;
  setPose: (pose?: ChickPose) => void;
  resetPose: () => void;
  setFacing: (direction: ChickFacing) => void;
  getFacing: () => ChickFacing;
  setScale: (scale: number) => void;
  destroy: () => void;
  metrics: typeof CHICK_METRICS;
};

const createFoot = (colors: Theme['chick']) => {
  const container = new Container();
  const leg = new Graphics();
  leg
    .roundRect(-3, -CHICK_METRICS.feet.liftRange, 6, CHICK_METRICS.feet.liftRange + 6, 3)
    .fill({ color: colors.leg });
  const toes = new Graphics();
  toes
    .moveTo(-8, 0)
    .lineTo(-2, 6)
    .moveTo(0, 0)
    .lineTo(0, 8)
    .moveTo(8, 0)
    .lineTo(2, 6)
    .stroke({ color: colors.toe, width: 4, alpha: 0.95 });
  container.addChild(leg, toes);
  return container;
};

export const createChick = (colors: Theme['chick']): Chick => {
  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'static';

  let scaleMagnitude = BASE_SCALE;
  let facing: ChickFacing = 'right';

  const applyScaleAndFacing = () => {
    const sign = facing === 'left' ? -1 : 1;
    view.scale.set(scaleMagnitude * sign, scaleMagnitude);
  };

  const shadow = new Graphics();
  shadow
    .ellipse(0, 0, CHICK_METRICS.shadow.width / 2, CHICK_METRICS.shadow.height / 2)
    .fill({ color: colors.shadow, alpha: 0.22 });
  shadow.position.y = CHICK_METRICS.shadow.offsetY;
  shadow.zIndex = 0;
  view.addChild(shadow);

  const backFoot = createFoot(colors);
  backFoot.position.set(-CHICK_METRICS.feet.spacing / 2, CHICK_METRICS.feet.groundY);
  backFoot.zIndex = 0.85;
  view.addChild(backFoot);

  const frontFoot = createFoot(colors);
  frontFoot.position.set(CHICK_METRICS.feet.spacing / 2, CHICK_METRICS.feet.groundY);
  frontFoot.zIndex = 0.9;
  view.addChild(frontFoot);

  const body = new Container();
  body.position.set(CHICK_METRICS.body.offset.x, CHICK_METRICS.body.offset.y);
  body.zIndex = 1;

  const bodyShape = new Graphics();
  bodyShape
    .ellipse(0, 0, CHICK_METRICS.body.width / 2, CHICK_METRICS.body.height / 2)
    .fill({ color: colors.bodyPrimary })
    .stroke({ color: colors.outline, width: 2, alpha: 0.35 });

  const belly = new Graphics();
  belly
    .ellipse(10, 4, CHICK_METRICS.body.width * 0.55, CHICK_METRICS.body.height * 0.55)
    .fill({ color: colors.bellyHighlight, alpha: 0.85 });

  const tail = new Graphics();
  tail
    .ellipse(CHICK_METRICS.tail.offset.x, CHICK_METRICS.tail.offset.y, CHICK_METRICS.tail.width / 2, CHICK_METRICS.tail.height / 2)
    .fill({ color: colors.bodyPrimary })
    .stroke({ color: colors.outline, width: 2, alpha: 0.25 });
  tail.zIndex = 0.95;

  body.addChild(bodyShape, belly, tail);
  view.addChild(body);

  const wingLeft = new Container();
  const wingLeftShape = new Graphics();
  wingLeftShape
    .ellipse(0, 0, CHICK_METRICS.wing.width / 2, CHICK_METRICS.wing.height / 2)
    .fill({ color: colors.wingShadow, alpha: 0.9 });
  wingLeft.addChild(wingLeftShape);
  wingLeft.position.set(CHICK_METRICS.wing.offset.x, CHICK_METRICS.wing.offset.y);
  wingLeft.pivot.set(0, 0);
  wingLeft.zIndex = 1.05;
  view.addChild(wingLeft);

  const wingRight = new Container();
  const wingRightShape = new Graphics();
  wingRightShape
    .ellipse(0, 0, CHICK_METRICS.wing.width / 2, CHICK_METRICS.wing.height / 2)
    .fill({ color: colors.wing, alpha: 0.92 });
  wingRight.addChild(wingRightShape);
  wingRight.position.set(CHICK_METRICS.wing.offset.x + 6, CHICK_METRICS.wing.offset.y - 4);
  wingRight.pivot.set(0, 0);
  wingRight.zIndex = 1.2;
  view.addChild(wingRight);

  const head = new Container();
  head.position.set(CHICK_METRICS.head.offset.x, CHICK_METRICS.head.offset.y);
  head.zIndex = 1.35;

  const headShape = new Graphics();
  headShape
    .circle(0, 0, CHICK_METRICS.head.radius)
    .fill({ color: colors.bodyPrimary })
    .stroke({ color: colors.outline, width: 2, alpha: 0.25 });

  const headHighlight = new Graphics();
  headHighlight
    .ellipse(-6, -10, CHICK_METRICS.head.radius * 0.8, CHICK_METRICS.head.radius * 0.7)
    .fill({ color: colors.bellyHighlight, alpha: 0.7 });

  const crest = new Graphics();
  crest
    .moveTo(CHICK_METRICS.crest.offset.x - 10, CHICK_METRICS.crest.offset.y)
    .quadraticCurveTo(CHICK_METRICS.crest.offset.x - 4, CHICK_METRICS.crest.offset.y - CHICK_METRICS.crest.height, CHICK_METRICS.crest.offset.x, CHICK_METRICS.crest.offset.y)
    .quadraticCurveTo(CHICK_METRICS.crest.offset.x + 4, CHICK_METRICS.crest.offset.y - CHICK_METRICS.crest.height * 0.9, CHICK_METRICS.crest.offset.x + 10, CHICK_METRICS.crest.offset.y)
    .fill({ color: colors.crest, alpha: 0.9 });

  const eye = new Graphics();
  eye
    .circle(CHICK_METRICS.eye.offset.x - CHICK_METRICS.head.offset.x, CHICK_METRICS.eye.offset.y - CHICK_METRICS.head.offset.y, CHICK_METRICS.eye.radius)
    .fill({ color: colors.eye });

  const eyeHighlight = new Graphics();
  eyeHighlight
    .circle(
      CHICK_METRICS.eye.offset.x - CHICK_METRICS.head.offset.x - 2,
      CHICK_METRICS.eye.offset.y - CHICK_METRICS.head.offset.y - 2,
      CHICK_METRICS.eye.highlight,
    )
    .fill({ color: colors.eyeHighlight, alpha: 0.9 });
  eye.addChild(eyeHighlight);

  const beak = new Container();
  beak.position.set(
    CHICK_METRICS.beak.offset.x - CHICK_METRICS.head.offset.x,
    CHICK_METRICS.beak.offset.y - CHICK_METRICS.head.offset.y,
  );
  beak.pivot.set(0, 0);

  const beakTop = new Graphics();
  beakTop
    .moveTo(0, 0)
    .lineTo(CHICK_METRICS.beak.length, -CHICK_METRICS.beak.thickness * 0.2)
    .lineTo(CHICK_METRICS.beak.length * 0.6, -CHICK_METRICS.beak.thickness * 0.4)
    .closePath()
    .fill({ color: colors.beakTop })
    .stroke({ color: colors.outline, width: 1.5, alpha: 0.35 });

  const beakBottom = new Graphics();
  beakBottom
    .moveTo(0, 0)
    .lineTo(CHICK_METRICS.beak.length, CHICK_METRICS.beak.thickness * 0.2)
    .lineTo(CHICK_METRICS.beak.length * 0.5, CHICK_METRICS.beak.thickness * 0.4)
    .closePath()
    .fill({ color: colors.beakBottom })
    .stroke({ color: colors.outline, width: 1.5, alpha: 0.2 });

  beak.addChild(beakBottom, beakTop);

  head.addChild(headShape, headHighlight, crest, beak, eye);
  view.addChild(head);

  const state: { pose: ChickPoseState } = {
    pose: { ...CHICK_IDLE_POSE },
  };

  const baseRotations = {
    body: -0.08,
    head: 0,
    wingLeft: -0.25,
    wingRight: 0.18,
    tail: -0.08,
  } as const;

  const applyPose = () => {
    const pose = state.pose;
    const hop = pose.hop ?? CHICK_IDLE_POSE.hop;

    body.rotation = baseRotations.body + (pose.bodyLean ?? CHICK_IDLE_POSE.bodyLean);
    body.position.y = CHICK_METRICS.body.offset.y + (pose.bodyLift ?? CHICK_IDLE_POSE.bodyLift) - hop * 0.5;

    head.rotation = baseRotations.head + (pose.headTilt ?? CHICK_IDLE_POSE.headTilt);
    head.position.set(
      CHICK_METRICS.head.offset.x + (pose.headForward ?? CHICK_IDLE_POSE.headForward),
      CHICK_METRICS.head.offset.y + (pose.headBob ?? CHICK_IDLE_POSE.headBob) - hop * 0.6,
    );

    const beakOpen = clamp(pose.beakOpen ?? CHICK_IDLE_POSE.beakOpen, 0, 0.9);
    beakTop.rotation = -0.05 - beakOpen * 0.12;
    beakBottom.rotation = 0.08 + beakOpen * 0.18;

    const wingLift = pose.wingLift ?? CHICK_IDLE_POSE.wingLift;
    const wingSpread = pose.wingSpread ?? CHICK_IDLE_POSE.wingSpread;
    wingLeft.rotation = baseRotations.wingLeft + wingLift * 0.9;
    wingRight.rotation = baseRotations.wingRight - wingLift * 0.7;
    const spreadScale = lerp(1, 1.18, clamp(Math.abs(wingSpread), 0, 1));
    wingLeft.scale.set(spreadScale, 1);
    wingRight.scale.set(spreadScale, 1);

    const tailLift = pose.tailLift ?? CHICK_IDLE_POSE.tailLift;
    tail.rotation = baseRotations.tail + tailLift * 0.8;

    const stride = clamp(pose.stride ?? CHICK_IDLE_POSE.stride, -1, 1);
    const strideOffset = stride * CHICK_METRICS.feet.strideRange;
    frontFoot.position.x = CHICK_METRICS.feet.spacing / 2 + strideOffset;
    backFoot.position.x = -CHICK_METRICS.feet.spacing / 2 - strideOffset * 0.6;

    frontFoot.position.y = CHICK_METRICS.feet.groundY + clamp(pose.frontFootLift ?? CHICK_IDLE_POSE.frontFootLift, -CHICK_METRICS.feet.liftRange, CHICK_METRICS.feet.liftRange);
    backFoot.position.y = CHICK_METRICS.feet.groundY + clamp(pose.backFootLift ?? CHICK_IDLE_POSE.backFootLift, -CHICK_METRICS.feet.liftRange, CHICK_METRICS.feet.liftRange);

    shadow.scale.x = lerp(1, 1.1, Math.abs(stride) * 0.4);
    shadow.scale.y = lerp(1, 0.9, Math.abs(stride) * 0.4);
  };

  const setPose = (pose: ChickPose = {}) => {
    state.pose = { ...state.pose, ...pose } as ChickPoseState;
    applyPose();
  };

  const resetPose = () => {
    state.pose = { ...CHICK_IDLE_POSE };
    applyPose();
  };

  const setScale = (scale: number) => {
    scaleMagnitude = Math.max(0.05, scale);
    applyScaleAndFacing();
  };

  const setFacing = (direction: ChickFacing) => {
    if (direction === facing) {
      return;
    }
    facing = direction;
    applyScaleAndFacing();
  };

  const getFacing = () => facing;

  const destroy = () => {
    view.destroy({ children: true });
  };

  applyPose();
  applyScaleAndFacing();

  return {
    view,
    setPose,
    resetPose,
    setFacing,
    getFacing,
    setScale,
    destroy,
    metrics: CHICK_METRICS,
  } as const;
};
