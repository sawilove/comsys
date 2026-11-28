export function watchWebUpdates(onUpdate: () => void) {
  if (!import.meta.env.PROD || __COMSYS_NATIVE__ || !('serviceWorker' in navigator)) return;
  const workers = navigator.serviceWorker;
  let previous = workers.controller;
  let registration: ServiceWorkerRegistration | undefined;
  const changed = () => {
    if (previous && workers.controller && previous !== workers.controller) onUpdate();
    previous = workers.controller;
  };
  const check = () => {
    if (document.visibilityState === 'visible') void registration?.update().catch(() => {});
  };
  workers.addEventListener('controllerchange', changed);
  void workers.register(import.meta.env.BASE_URL + 'sw.js', { updateViaCache: 'none' }).then((worker) => {
    registration = worker;
    check();
  }).catch(() => {});
  const timer = setInterval(check, 60_000);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  return () => {
    clearInterval(timer);
    workers.removeEventListener('controllerchange', changed);
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
  };
}
