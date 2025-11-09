import balloonInflation from './balloon_inflation.mp3';
import discoCrowdApplause from './disco_crowd_applause.mp3';
import fireworksShow from './fireworks_show.mp3';
import henLaysChatter from './hen_lays_chatter.mp3';
import jetpackAirLeakLoop from './jetpack_air_leak_loop.mp3';
import chickenCluckSoft from './chicken_cluck_soft.mp3';
import ambientCluck01 from './ambient_cluck_01.mp3';
import ambientCluck02 from './ambient_cluck_02.mp3';
import ambientCluck03 from './ambient_cluck_03.mp3';
import ambientCluck04 from './ambient_cluck_04.mp3';
import chickenCackle from './chicken_cackle.mp3';
import chickenWingFlap from './chicken_wing_flap.mp3';
import chickPeep from './chick_peep.mp3';
import bubbleBurst from './bubble_burst.mp3';
import eggShellPop from './egg_shell_pop.mp3';

export const audioManifest = {
  balloonInflation,
  discoCrowdApplause,
  fireworksShow,
  henLaysChatter,
  jetpackAirLeakLoop,
  chickenCluckSoft,
  ambientCluck01,
  ambientCluck02,
  ambientCluck03,
  ambientCluck04,
  chickenCackle,
  chickenWingFlap,
  chickPeep,
  bubbleBurst,
  eggShellPop,
} as const;

export type AudioEffectKey = keyof typeof audioManifest;
