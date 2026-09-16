import type { ComponentType, RefObject } from 'react';
import type { BackdropLook, GlassTarget } from '../Backdrop';

export type EraProps = {
  /** the era fills this with the panels the backdrop should render as glass */
  glass: RefObject<GlassTarget[]>;
};

export type Era = {
  id: string;
  label: string;
  look: BackdropLook;
  Component: ComponentType<EraProps>;
};
