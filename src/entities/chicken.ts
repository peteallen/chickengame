import { Container, Graphics } from 'pixi.js';
import type { Theme } from '../config/theme';

const degToRad = (deg: number) => (deg * Math.PI) / 180;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
type Point = { x: number; y: number };
const rotatePoint = (point: Point, angle: number, pivot: Point): Point => {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const translatedX = point.x - pivot.x;
  const translatedY = point.y - pivot.y;
  return {
    x: translatedX * cos - translatedY * sin + pivot.x,
    y: translatedX * sin + translatedY * cos + pivot.y,
  };
};

const CHICKEN_METRICS = {
  referenceWidth: 220,
  shadow: { width: 160, height: 48 },
  feet: {
    groundY: 8,
    front: { x: 34 },
    back: { x: -42 },
    legWidth: 10,
    legLength: 23,
    toeLength: 30,
    toeWidth: 6,
    toeSpread: 20,
    strideRange: 18,
    liftRange: 26,
  },
  body: {
    width: 172,
    height: 136,
    offset: { x: -6, y: -64 },
    highlight: {
      width: 118,
      height: 96,
      offset: { x: 24, y: -42 },
    },
    chest: {
      width: 124,
      height: 112,
      offset: { x: 26, y: -28 },
    },
  },
  wing: {
    width: 128,
    height: 88,
    anchor: { x: 0, y: 0 },
    pivot: { x: 0, y: 0 },
    featherBands: 3,
  },
  tail: {
    base: { x: -82, y: -58 },
    length: 112,
    spread: 74,
    layers: 4,
  },
  head: {
    width: 92,
    height: 92,
    offset: { x: 84, y: -122 },
    cheekRadius: 18,
    cheekOffset: { x: 60, y: -104 },
  },
  comb: {
    lobeRadius: 18,
    offsets: [60, 34, 12],
    baseY: -168,
  },
  wattle: {
    width: 32,
    height: 26,
    offset: { x: 96, y: -84 },
  },
  beak: {
    length: 27.6,
    thickness: 36,
    hinge: { x: 118, y: -102 },
    overbite: 6,
  },
  eye: {
    radius: 8,
    highlightRadius: 3,
    offset: { x: 102, y: -128 },
  },
} as const;

export type ChickenPoseState = {
  bodyLean: number;
  bodyLift: number;
  headPitch: number;
  headBob: number;
  headForward: number;
  beakOpen: number;
  wingPitch: number;
  wingLift: number;
  tailLift: number;
  tailSplay: number;
  stride: number;
  frontFootLift: number;
  backFootLift: number;
};

export type ChickenPose = Partial<ChickenPoseState>;

type ChickenParts = {
  view: Container;
  body: Container;
  head: Container;
  wing: Container;
  tail: Container;
  frontFoot: Container;
  backFoot: Container;
  beak: Container;
  eye: Graphics;
  shadow: Graphics;
};

export type ChickenFacing = 'left' | 'right';

export type Chicken = {
  view: Container;
  parts: ChickenParts;
  setPose: (pose?: ChickenPose) => void;
  resetPose: () => void;
  setScale: (scale: number) => void;
  setFacing: (direction: ChickenFacing) => void;
  toggleFacing: () => void;
  getFacing: () => ChickenFacing;
  metrics: typeof CHICKEN_METRICS;
};

const BASE_SCALE = 0.49;

export const CHICKEN_IDLE_POSE: ChickenPoseState = {
  bodyLean: -0.04,
  bodyLift: -4,
  headPitch: 0.12,
  headBob: -2,
  headForward: 0,
  beakOpen: 0.05,
  wingPitch: 0,
  wingLift: 0,
  tailLift: 0.06,
  tailSplay: 0.4,
  stride: 0,
  frontFootLift: 0,
  backFootLift: 0,
} as const;

const createFoot = (colors: Theme['chicken']) => {
  const container = new Container();
  const leg = new Graphics();
  leg
    .roundRect(
      -CHICKEN_METRICS.feet.legWidth / 2,
      -CHICKEN_METRICS.feet.legLength,
      CHICKEN_METRICS.feet.legWidth,
      CHICKEN_METRICS.feet.legLength,
      CHICKEN_METRICS.feet.legWidth,
    )
    .fill({ color: colors.leg });

  const toes = new Container();
  const toeAngles = [-35, 0, 35];
  toeAngles.forEach((angle, index) => {
    const toe = new Graphics();
    toe
      .roundRect(
        -CHICKEN_METRICS.feet.toeWidth / 2,
        0,
        CHICKEN_METRICS.feet.toeWidth,
        CHICKEN_METRICS.feet.toeLength,
        CHICKEN_METRICS.feet.toeWidth,
      )
      .fill({ color: colors.toe });
    toe.rotation = degToRad(angle);
    toe.position.set(0, 0);
    toes.addChild(toe);
  });

  const talon = new Graphics();
  talon
    .roundRect(-CHICKEN_METRICS.feet.toeWidth, -6, CHICKEN_METRICS.feet.toeWidth, 16, CHICKEN_METRICS.feet.toeWidth)
    .fill({ color: colors.footShadow, alpha: 0.5 });
  talon.rotation = degToRad(-32);
  talon.position.set(-CHICKEN_METRICS.feet.toeSpread * 0.4, 4);

  const padShadow = new Graphics();
  padShadow
    .ellipse(0, CHICKEN_METRICS.feet.toeLength - 4, CHICKEN_METRICS.feet.toeSpread * 0.9, CHICKEN_METRICS.feet.toeWidth)
    .fill({ color: colors.footShadow, alpha: 0.25 });

  toes.addChildAt(padShadow, 0);
  container.addChild(toes, leg, talon);
  return container;
};

const createTail = (colors: Theme['chicken']) => {
  const tail = new Container();
  const socket = new Graphics();
  socket
    .ellipse(-32, 24, 38, 46)
    .fill({ color: colors.bodyPrimary, alpha: 0.95 });
  tail.addChild(socket);

  const plumeWidth = CHICKEN_METRICS.tail.length * 0.78;
  const plumeHeight = CHICKEN_METRICS.tail.spread * 0.9;
  const plumeOffset = { x: -34, y: 6 };

  const featherLines = new Graphics();
  const lineCount = 4;
  for (let i = 0; i < lineCount; i += 1) {
    const t = i / (lineCount - 1);
    const startY = plumeOffset.y - 6 - t * 12;
    const startX = plumeOffset.x + 12;
    featherLines
      .moveTo(startX, startY)
      .quadraticCurveTo(
        plumeOffset.x - plumeWidth * (0.28 + t * 0.12),
        plumeOffset.y - plumeHeight * (0.22 + t * 0.18),
        plumeOffset.x - plumeWidth * 0.55,
        plumeOffset.y - plumeHeight * (0.52 + t * 0.14),
      )
      .stroke({ color: colors.tailShadow, width: 4, alpha: 0.4 });
  }

  const fanGuide = new Graphics();
  fanGuide
    .moveTo(plumeOffset.x + 12, plumeOffset.y - 4)
    .quadraticCurveTo(
      plumeOffset.x - plumeWidth * 0.4,
      plumeOffset.y - plumeHeight * 0.4,
      plumeOffset.x - plumeWidth * 0.9,
      plumeOffset.y - plumeHeight * 0.08,
    )
    .stroke({ color: colors.tail, width: 6, alpha: 0.6 });

  const plume = new Graphics();
  plume
    .ellipse(plumeOffset.x, plumeOffset.y, plumeWidth / 2, plumeHeight / 2)
    .fill({ color: colors.tail });

  tail.addChild(fanGuide, featherLines);
  tail.position.set(CHICKEN_METRICS.tail.base.x, CHICKEN_METRICS.tail.base.y);
  tail.pivot.set(-10, 0);
  tail.zIndex = 0.8;
  return tail;
};

const createWing = (colors: Theme['chicken']) => {
  const wing = new Container();
  wing.position.set(CHICKEN_METRICS.wing.anchor.x, CHICKEN_METRICS.wing.anchor.y);
  wing.pivot.set(CHICKEN_METRICS.wing.pivot.x, CHICKEN_METRICS.wing.pivot.y);
  wing.zIndex = 2.2;

  const shell = new Graphics();
  shell
    .ellipse(0, 0, CHICKEN_METRICS.wing.width / 2, CHICKEN_METRICS.wing.height / 2)
    .fill({ color: colors.wing });

  const panel = new Graphics();
  panel
    .moveTo(-40, -10)
    .quadraticCurveTo(30, -24, 52, 6)
    .quadraticCurveTo(-6, 42, -36, 26)
    .closePath()
    .fill({ color: colors.wingShadow, alpha: 0.6 });

  const bandCount = CHICKEN_METRICS.wing.featherBands;
  for (let i = 0; i < bandCount; i += 1) {
    const ridge = new Graphics();
    const progress = i / Math.max(1, bandCount - 1);
    ridge
      .moveTo(-44, -6 + progress * 28)
      .quadraticCurveTo(12, 10 + progress * 32, 48, 22 + progress * 22)
      .stroke({ color: colors.wingShadow, width: 3, alpha: 0.35 });
    wing.addChild(ridge);
  }

  wing.addChildAt(shell, 0);
  wing.addChild(panel);
  return wing;
};

const createHead = (colors: Theme['chicken']) => {
  const head = new Container();
  head.position.set(CHICKEN_METRICS.head.offset.x, CHICKEN_METRICS.head.offset.y);

  const base = new Graphics();
  base
    .ellipse(0, 0, CHICKEN_METRICS.head.width / 2, CHICKEN_METRICS.head.height / 2)
    .fill({ color: colors.head });

  const cheek = new Graphics();
  cheek.circle(0, 0, CHICKEN_METRICS.head.cheekRadius).fill({ color: colors.cheek, alpha: 0.9 });
  cheek.position.set(
    CHICKEN_METRICS.head.cheekOffset.x - CHICKEN_METRICS.head.offset.x,
    CHICKEN_METRICS.head.cheekOffset.y - CHICKEN_METRICS.head.offset.y,
  );

  const comb = new Container();
  const combBaseY = CHICKEN_METRICS.comb.baseY - CHICKEN_METRICS.head.offset.y;
  const combStep = 6;
  const combLobes = [
    { x: CHICKEN_METRICS.comb.offsets[0], radius: CHICKEN_METRICS.comb.lobeRadius * 1.05, heightOffset: 2 },
    { x: CHICKEN_METRICS.comb.offsets[1], radius: CHICKEN_METRICS.comb.lobeRadius * 1.2, heightOffset: -6 },
    { x: CHICKEN_METRICS.comb.offsets[2], radius: CHICKEN_METRICS.comb.lobeRadius * 0.9, heightOffset: 8 },
  ];
  const combTiltAngle = degToRad(38);
  const combPivot: Point = {
    x: Math.min(...CHICKEN_METRICS.comb.offsets) - 10,
    y: combBaseY + combStep,
  };
  const combLift = -26;
  combLobes.forEach((lobe, index) => {
    const basePosition: Point = {
      x: lobe.x,
      y: combBaseY + index * combStep + lobe.heightOffset,
    };
    const rotated = rotatePoint(basePosition, combTiltAngle, combPivot);
    const lobeShape = new Graphics();
    lobeShape.circle(0, 0, lobe.radius).fill({ color: colors.comb });
    lobeShape.position.set(rotated.x, rotated.y + combLift);
    comb.addChild(lobeShape);
  });

  const wattle = new Graphics();
  wattle
    .ellipse(
      0,
      0,
      CHICKEN_METRICS.wattle.height / 2,
      CHICKEN_METRICS.wattle.width / 2,
    )
    .fill({ color: colors.wattle });
  wattle.position.set(
    CHICKEN_METRICS.wattle.offset.x - CHICKEN_METRICS.head.offset.x,
    CHICKEN_METRICS.wattle.offset.y - CHICKEN_METRICS.head.offset.y + 10,
  );

  const eye = new Graphics();
  eye.circle(0, 0, CHICKEN_METRICS.eye.radius).fill({ color: colors.eye });
  const eyeHighlight = new Graphics();
  eyeHighlight
    .circle(0, 0, CHICKEN_METRICS.eye.highlightRadius)
    .fill({ color: colors.eyeHighlight, alpha: 0.95 });
  eyeHighlight.position.set(-CHICKEN_METRICS.eye.radius * 0.35, -CHICKEN_METRICS.eye.radius * 0.35);
  eye.addChild(eyeHighlight);
  eye.position.set(
    CHICKEN_METRICS.eye.offset.x - CHICKEN_METRICS.head.offset.x,
    CHICKEN_METRICS.eye.offset.y - CHICKEN_METRICS.head.offset.y,
  );

  const beak = new Container();
  const hingeY = CHICKEN_METRICS.beak.hinge.y - CHICKEN_METRICS.head.offset.y;
  beak.position.set(
    CHICKEN_METRICS.beak.hinge.x - CHICKEN_METRICS.head.offset.x,
    hingeY,
  );
  beak.pivot.set(0, 0);

  const halfHeight = CHICKEN_METRICS.beak.thickness / 2;
  const beakTipX = CHICKEN_METRICS.beak.length;
  const dividerInset = Math.max(3, CHICKEN_METRICS.beak.overbite * 0.6);

  const lowerBeak = new Graphics();
  lowerBeak
    .moveTo(0, 0)
    .lineTo(beakTipX, 0)
    .lineTo(0, halfHeight)
    .closePath()
    .fill({ color: colors.beakBottom });

  const upperBeak = new Graphics();
  upperBeak
    .moveTo(0, -halfHeight)
    .lineTo(beakTipX, 0)
    .lineTo(0, 0)
    .closePath()
    .fill({ color: colors.beakTop });

  const beakDivider = new Graphics();
  beakDivider
    .moveTo(dividerInset, 0)
    .lineTo(beakTipX - dividerInset * 0.4, 0)
    .stroke({ color: colors.shadow, width: 2.2, alpha: 0.5, cap: 'round' });

  const beakOutline = new Graphics();
  beakOutline
    .moveTo(0, -halfHeight)
    .lineTo(beakTipX, 0)
    .lineTo(0, halfHeight)
    .closePath()
    .stroke({ color: colors.outline, width: 2, alpha: 0.25 });

  beak.addChild(lowerBeak, upperBeak, beakDivider, beakOutline);

  head.addChild(base, cheek, comb, wattle, beak, eye);
  head.zIndex = 2.6;

  return { head, beak, eye } as const;
};

export const createChicken = (colors: Theme['chicken']): Chicken => {
  const view = new Container();
  view.sortableChildren = true;
  view.eventMode = 'static';
  view.cursor = 'pointer';

  let scaleMagnitude = BASE_SCALE;
  let facing: ChickenFacing = 'right';

  const applyScaleAndFacing = () => {
    const sign = facing === 'left' ? -1 : 1;
    view.scale.set(scaleMagnitude * sign, scaleMagnitude);
  };

  const shadow = new Graphics();
  shadow
    .ellipse(0, 0, CHICKEN_METRICS.shadow.width / 2, CHICKEN_METRICS.shadow.height / 2)
    .fill({ color: colors.shadow, alpha: 0.2 });
  const shadowY =
    CHICKEN_METRICS.feet.groundY + CHICKEN_METRICS.feet.toeLength - CHICKEN_METRICS.shadow.height * 0.15;
  shadow.position.set(0, shadowY);
  shadow.zIndex = 0;

  const backFoot = createFoot(colors);
  backFoot.position.set(CHICKEN_METRICS.feet.back.x, CHICKEN_METRICS.feet.groundY);
  backFoot.zIndex = 0.9;

  const frontFoot = createFoot(colors);
  frontFoot.position.set(CHICKEN_METRICS.feet.front.x, CHICKEN_METRICS.feet.groundY);
  frontFoot.zIndex = 1;

  const body = new Container();
  body.position.set(CHICKEN_METRICS.body.offset.x, CHICKEN_METRICS.body.offset.y);
  body.sortableChildren = true;

  const bodyBase = new Graphics();
  bodyBase
    .ellipse(0, 0, CHICKEN_METRICS.body.width / 2, CHICKEN_METRICS.body.height / 2)
    .fill({ color: colors.bodyPrimary });

  const chest = new Graphics();
  chest
    .ellipse(
      CHICKEN_METRICS.body.chest.offset.x,
      CHICKEN_METRICS.body.chest.offset.y,
      CHICKEN_METRICS.body.chest.width / 2,
      CHICKEN_METRICS.body.chest.height / 2,
    )
    .fill({ color: colors.bellyHighlight, alpha: 0.85 });

  const highlight = new Graphics();
  highlight
    .ellipse(
      CHICKEN_METRICS.body.highlight.offset.x,
      CHICKEN_METRICS.body.highlight.offset.y,
      CHICKEN_METRICS.body.highlight.width / 2,
      CHICKEN_METRICS.body.highlight.height / 2,
    )
    .fill({ color: colors.bellyHighlight, alpha: 0.5 });

  const outline = new Graphics();
  outline
    .ellipse(0, 0, CHICKEN_METRICS.body.width / 2, CHICKEN_METRICS.body.height / 2)
    .stroke({ color: colors.outline, width: 4, alpha: 0.35 });

  const tail = createTail(colors);
  const wing = createWing(colors);
  wing.zIndex = 2.2;

  body.addChildAt(tail, 0);
  body.addChild(bodyBase, chest, highlight, wing, outline);
  body.zIndex = 2;

  const { head, beak, eye } = createHead(colors);

  view.addChild(shadow, backFoot, frontFoot, body, head);

  const baseRotations = {
    body: degToRad(-4),
    head: degToRad(-6),
    wing: degToRad(-4),
    beak: degToRad(30),
    tail: degToRad(-28),
  } as const;
  const defaultPose: ChickenPoseState = { ...CHICKEN_IDLE_POSE };

  const state: { pose: ChickenPoseState } = { pose: { ...defaultPose } };

  const applyPose = () => {
    const pose = state.pose;

    body.rotation = baseRotations.body + (pose.bodyLean ?? defaultPose.bodyLean);
    body.position.y = CHICKEN_METRICS.body.offset.y + (pose.bodyLift ?? defaultPose.bodyLift);

    wing.rotation = baseRotations.wing + (pose.wingPitch ?? defaultPose.wingPitch);
    wing.position.y = CHICKEN_METRICS.wing.anchor.y + (pose.wingLift ?? defaultPose.wingLift);

    head.rotation = baseRotations.head + (pose.headPitch ?? defaultPose.headPitch);
    head.position.set(
      CHICKEN_METRICS.head.offset.x + (pose.headForward ?? defaultPose.headForward),
      CHICKEN_METRICS.head.offset.y + (pose.headBob ?? defaultPose.headBob),
    );

    const beakOpen = clamp(pose.beakOpen ?? defaultPose.beakOpen, 0, 0.9);
    beak.rotation = baseRotations.beak + beakOpen * 0.35;

    const tailSplay = clamp(pose.tailSplay ?? defaultPose.tailSplay, 0, 1);
    tail.rotation = baseRotations.tail + (pose.tailLift ?? defaultPose.tailLift);
    tail.scale.set(1 + tailSplay * 0.25, 1 + tailSplay * 0.1);

    const stride = clamp(pose.stride ?? defaultPose.stride, -1, 1);
    const strideOffset = stride * CHICKEN_METRICS.feet.strideRange;
    backFoot.position.x = CHICKEN_METRICS.feet.back.x - strideOffset * 0.4;
    frontFoot.position.x = CHICKEN_METRICS.feet.front.x + strideOffset;

    backFoot.position.y = CHICKEN_METRICS.feet.groundY + clamp(pose.backFootLift ?? defaultPose.backFootLift, -CHICKEN_METRICS.feet.liftRange, CHICKEN_METRICS.feet.liftRange);
    frontFoot.position.y = CHICKEN_METRICS.feet.groundY + clamp(pose.frontFootLift ?? defaultPose.frontFootLift, -CHICKEN_METRICS.feet.liftRange, CHICKEN_METRICS.feet.liftRange);

    shadow.scale.x = lerp(1, 1.08, Math.abs(stride) * 0.5);
    shadow.scale.y = lerp(1, 0.92, Math.abs(stride) * 0.5);
  };

  const setPose = (pose: ChickenPose = {}) => {
    state.pose = { ...state.pose, ...pose } as ChickenPoseState;
    applyPose();
  };

  const resetPose = () => {
    state.pose = { ...defaultPose };
    applyPose();
  };

  applyPose();

  const parts: ChickenParts = {
    view,
    body,
    head,
    wing,
    tail,
    frontFoot,
    backFoot,
    beak,
    eye,
    shadow,
  };

  const setScale = (scale: number) => {
    scaleMagnitude = Math.max(0.01, scale * BASE_SCALE);
    applyScaleAndFacing();
  };

  const setFacing = (direction: ChickenFacing) => {
    if (facing === direction) {
      return;
    }
    facing = direction;
    applyScaleAndFacing();
  };

  const toggleFacing = () => {
    setFacing(facing === 'right' ? 'left' : 'right');
  };

  const getFacing = () => facing;

  applyScaleAndFacing();

  return {
    view,
    parts,
    setPose,
    resetPose,
    setScale,
    setFacing,
    toggleFacing,
    getFacing,
    metrics: CHICKEN_METRICS,
  };
};
