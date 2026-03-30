import { createContext } from 'react';
import { AppContextType } from './AppLogic';

export const AppContext = createContext<AppContextType | undefined>(undefined);
