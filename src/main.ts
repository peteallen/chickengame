import './styles/index.css';
import { bootstrap } from './app/bootstrap';
import { isDevModeEnabled } from './config';

bootstrap({ devMode: isDevModeEnabled() }).catch((error) => {
  console.error('Failed to start the scene', error);
});
