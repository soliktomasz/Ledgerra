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

export function DashboardIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 13h7V4H4z" />
      <path d="M13 20h7v-9h-7z" />
      <path d="M13 4h7v7h-7z" />
      <path d="M4 20h7v-5H4z" />
    </BaseIcon>
  );
}

export function ReportsIcon(props: IconProps) {
  return <TrendIcon {...props} />;
}

export function TransactionsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
      <path d="m15 5 4 2-4 2" />
      <path d="m9 10-4 2 4 2" />
      <path d="m15 15 4 2-4 2" />
    </BaseIcon>
  );
}

export function ImportsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 20h14" />
    </BaseIcon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 19h14" />
    </BaseIcon>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1Z" />
    </BaseIcon>
  );
}

export function AccountsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 14h3" />
    </BaseIcon>
  );
}

export function BudgetsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 5h12" />
      <path d="M6 12h12" />
      <path d="M6 19h12" />
      <path d="M9 5c0 2-1 3-3 3" />
      <path d="M18 19c0-2 1-3 3-3" />
    </BaseIcon>
  );
}

export function GoalsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5v-2" />
      <path d="M19 12h2" />
      <path d="M12 19v2" />
      <path d="M5 12H3" />
    </BaseIcon>
  );
}

export function CategoriesIcon(props: IconProps) {
  return <CategoryIcon {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="m5.64 5.64 2.12 2.12" />
      <path d="m16.24 16.24 2.12 2.12" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m5.64 18.36 2.12-2.12" />
      <path d="m16.24 7.76 2.12-2.12" />
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
