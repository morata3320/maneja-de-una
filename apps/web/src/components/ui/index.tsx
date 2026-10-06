import { useEffect, useId, useRef } from "react";
import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import { Icon } from "./Icon";
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    />
  );
}
export function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} {...props} />
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} aria-label={label} {...props}>
        {children}
      </select>
    </label>
  );
}
export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}
export function PriceDisplay({ price }: { price: number }) {
  return (
    <span className="price">
      <strong>${price}</strong>
      <span> / día</span>
    </span>
  );
}
export function Rating({
  value,
  reviews,
}: {
  value: number;
  reviews?: number;
}) {
  return (
    <span className="rating">
      <Icon name="star" size={14} />
      <strong>{value.toFixed(1)}</strong>
      {reviews !== undefined && <span>({reviews} reseñas)</span>}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  children,
  icon = "search",
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} size={32} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <EmptyState
      icon="info"
      title="No pudimos cargar los autos."
      description="Inténtalo otra vez en un momento."
    >
      <Button onClick={retry}>Intentar de nuevo</Button>
    </EmptyState>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
export function VehicleCardSkeleton() {
  return (
    <div
      className="card skeleton-card"
      aria-label="Cargando vehículo"
      role="status"
    >
      <Skeleton className="skeleton-image" />
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div
      className="container section"
      aria-label="Cargando página"
      role="status"
    >
      <Skeleton />
      <div className="vehicle-grid">
        {[0, 1, 2].map((i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
export function Modal({
  open,
  title,
  onClose,
  children,
  drawer = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (open && el && !el.open) el.showModal();
    else if (!open && el?.open) el.close();
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={drawer ? "modal drawer" : "modal"}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <header>
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" />
          </Button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Drawer(props: Omit<Parameters<typeof Modal>[0], "drawer">) {
  return <Modal {...props} drawer />;
}
