// App.js
import React, { useEffect, useState } from 'react';
import DesktopApp from './DesktopApp';
import MobileApp from './MobileApp';

function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return (
    <>
      {isMobile ? <MobileApp /> : <DesktopApp />}
    </>
  );
}

export default App;