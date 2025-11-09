import './styles/index.css';
import { bootstrap } from './app/bootstrap';

bootstrap().catch((error) => {
  console.error('Failed to start the scene', error);
});
