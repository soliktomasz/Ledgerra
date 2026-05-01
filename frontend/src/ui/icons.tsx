import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function TrendIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 16.5 9 11.5 13 14.5 20 7.5" />
      <path d="M15 7.5h5v5" />
      <path d="M4 20h16" />
    </BaseIcon>
  );
}

export function IncomeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 19V5" />
      <path d="M7 10 12 5l5 5" />
      <path d="M5 19h14" />
    </BaseIcon>
  );
}

export function ExpenseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="m7 14 5 5 5-5" />
      <path d="M5 5h14" />
    </BaseIcon>
  );
}

export function CashFlowIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h10" />
      <path d="m10 3 4 4-4 4" />
      <path d="M20 17H10" />
      <path d="m14 13-4 4 4 4" />
    </BaseIcon>
  );
}

export function CategoryIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 5h6v6H5z" />
      <path d="M13 5h6v3h-6z" />
      <path d="M13 10h6v9h-6z" />
      <path d="M5 13h6v6H5z" />
    </BaseIcon>
  );
}

export function NetWorthIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 18V9" />
      <path d="M10 18V5" />
      <path d="M16 18v-7" />
      <path d="M22 18V3" />
      <path d="M3 18h20" />
    </BaseIcon>
  );
}