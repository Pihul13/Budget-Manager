import { useEffect, useRef } from "react";
import { REFRESH_EVENT } from "./requestCache.js";

export function useApiCacheRefresh(refresh) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let timer;
    const handleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        Promise.resolve(refreshRef.current()).catch((error) => {
          console.error("Could not update the current view with fresh data.", error);
        });
      }, 100);
    };
    window.addEventListener(REFRESH_EVENT, handleRefresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(REFRESH_EVENT, handleRefresh);
    };
  }, []);
}
