import { useEffect, useRef, useState } from 'react';
import Backdrop, { BackdropLook, GlassTarget } from './Backdrop';
import EraSelector from './EraSelector';
import { ERAS, initialEra, saveEra } from './eras';

export default function App() {
  const [eraId, setEraId] = useState(initialEra);
  const era = ERAS.find((e) => e.id === eraId) ?? ERAS[0];

  // The era fills this in with its glass panels; the backdrop reads it every
  // frame to know what to refract. Cleared on a switch so a departed era's
  // panels are never measured.
  const glass = useRef<GlassTarget[]>([]);
  const look = useRef<BackdropLook>(era.look);
  look.current = era.look;

  useEffect(() => {
    document.documentElement.dataset.era = era.id;
    // Without WebGL nothing else drives the theme, so an era that wants dark
    // sets it here; with the scene running, Backdrop re-derives it per frame.
    if (era.look.forceDark) document.documentElement.classList.add('dark');
    else if (!document.documentElement.hasAttribute('data-sky'))
      document.documentElement.classList.remove('dark');
    return () => {
      glass.current = [];
    };
  }, [era]);

  return (
    <>
      <Backdrop glass={glass} look={look} />
      {/* The backdrop canvas is positioned, so unpositioned content would
          paint underneath it. Each era lifts its page into a layer above. */}
      <era.Component key={era.id} glass={glass} />
      <EraSelector
        era={era.id}
        onChange={(id) => {
          saveEra(id);
          setEraId(id);
        }}
      />
    </>
  );
}
