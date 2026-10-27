// Boot skeleton (index.html)
const FADE_MS = 220;

// Fade out once the app has painted with its fonts
export function hideBootSkeleton() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  const fonts = document.fonts?.ready ?? Promise.resolve();
  fonts.then(() =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        boot.classList.add('done');
        setTimeout(() => boot.remove(), FADE_MS + 50);
      }),
    ),
  );
}
