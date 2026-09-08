import { Link, useLocation, useNavigate, type LinkProps } from "react-router-dom";

/*
 * Bitrix opens records as sliders over the page you came from. A record route is /deals/:id or
 * /companies/:id; the list page underneath stays mounted. Sliders stack: opening a record from
 * inside another slider pushes the current record path onto location.state.stack.
 */

export const RECORD_RE = /^\/(deals|companies)\/(\d+)$/;
export const isRecordPath = (path: string): boolean => RECORD_RE.test(path);

export interface SliderState {
  stack?: string[];
  background?: string;
}

export const useSliderStack = (): string[] => {
  const location = useLocation();
  return ((location.state as SliderState | null)?.stack ?? []).filter(isRecordPath);
};

/** Link that opens a record as a slider on top of the current one (or of the list page). */
export function RecordLink({ to, state, ...rest }: LinkProps & { to: string }) {
  const location = useLocation();
  const stack = useSliderStack();
  const current = (location.state as SliderState | null) ?? {};
  const next: SliderState = isRecordPath(location.pathname)
    ? { stack: [...stack, location.pathname], background: current.background }
    : { stack: [], background: location.pathname + location.search };
  return <Link to={to} state={{ ...next, ...(state as object | undefined) }} {...rest} />;
}

export const useOpenRecord = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stack = useSliderStack();
  const current = (location.state as SliderState | null) ?? {};
  return (to: string) => {
    const next: SliderState = isRecordPath(location.pathname)
      ? { stack: [...stack, location.pathname], background: current.background }
      : { stack: [], background: location.pathname + location.search };
    navigate(to, { state: next });
  };
};

/** Closes the top slider: back to the slider below it, or to the page the first slider was opened from. */
export const useCloseSlider = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stack = useSliderStack();
  const background = (location.state as SliderState | null)?.background ?? "/";
  return () => {
    if (stack.length > 0) navigate(stack[stack.length - 1], { state: { stack: stack.slice(0, -1), background } });
    else navigate(background);
  };
};
