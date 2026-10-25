import { createContext, useContext } from 'react';

export interface ConfettiOptions {
  /** poziția exploziei, în procente din ecran */
  x?: number;
  y?: number;
}

export const ConfettiContext = createContext<(options?: ConfettiOptions) => void>(() => {});

/** Lansează confetti emoji. Se apelează doar după succesul real al unei operații. */
export const useChristmasConfetti = () => useContext(ConfettiContext);
