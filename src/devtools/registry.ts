import type { AnyDevEntityBlueprint } from './types';
import { chickenDevEntity } from './entities/chicken';
import { chickDevEntity } from './entities/chick';
import { balloonBundleDevEntity } from './entities/balloonBundle';
import { discoRigDevEntity } from './entities/discoRig';

export const DEV_ENTITY_BLUEPRINTS: AnyDevEntityBlueprint[] = [
  chickenDevEntity,
  chickDevEntity,
  balloonBundleDevEntity,
  discoRigDevEntity,
];

export const getEntityBlueprint = (id: string) =>
  DEV_ENTITY_BLUEPRINTS.find((blueprint) => blueprint.id === id);
