// Ask the canvas to fit the diagram
export const FIT_EVENT = 'seqdraw:fit';
export const requestFit = () => window.dispatchEvent(new Event(FIT_EVENT));
