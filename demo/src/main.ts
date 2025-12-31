import Playmaker from 'playmaker';
import '../../dist/playmaker.css';

// Demo usage - exactly as end users would use the library
const instance = Playmaker.init('#playmaker-container', {
  onChange: (data) => {
    console.log('Play data changed:', data);
  },
  onExport: (blob) => {
    console.log('Exported PNG:', blob);
  },
});

// Expose for debugging in browser console
declare global {
  interface Window {
    playmaker: typeof instance;
  }
}
window.playmaker = instance;
