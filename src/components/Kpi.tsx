/** Cartão de indicador (KPI) no topo dos ecrãs. */
export function Kpi({
  label,
  children,
  iva = false,
}: {
  label: string;
  children: React.ReactNode;
  iva?: boolean;
}) {
  return (
    <div className={`al-kpi ${iva ? "al-kpi-iva" : ""}`}>
      <span className="al-kpi-lbl">{label}</span>
      {children}
    </div>
  );
}
