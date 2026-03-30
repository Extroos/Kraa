import { useContext } from 'react';
import { AppContext } from '../store/AppContextContent';
import { AppContextType } from '../store/AppLogic';

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
