type Props = { styles: Record<string, string>; onChange: (styles: Record<string, string>) => void };

export default function FlexLayoutInspector({ styles, onChange }: Props) {
  const update = (key: string, value: string) => onChange({ ...styles, [key]: value });
  return <details className="ee-inspector-section" open>
    <summary>Disposición del grupo</summary>
    <div className="ee-inspector-section-body">
      <label className="ee-field"><span>Flujo</span>
        <select className="ee-select" value={styles.display ?? "block"} onChange={event => update("display", event.target.value)}>
          <option value="block">Vertical</option><option value="flex">Auto layout · Flex</option>
        </select>
      </label>
      {styles.display === "flex" && <>
        <label className="ee-field"><span>Dirección</span>
          <select className="ee-select" value={styles.flexDirection ?? "row"} onChange={event => update("flexDirection", event.target.value)}>
            <option value="row">Horizontal</option><option value="column">Vertical</option>
          </select>
        </label>
        <label className="ee-field"><span>Espaciado entre elementos</span><input className="ee-input" value={styles.gap ?? ""} onChange={event => update("gap", event.target.value)} placeholder="12px" /></label>
        <label className="ee-field"><span>Distribución horizontal</span>
          <select className="ee-select" value={styles.justifyContent ?? "flex-start"} onChange={event => update("justifyContent", event.target.value)}>
            <option value="flex-start">Inicio</option><option value="center">Centro</option><option value="space-between">Espacio entre</option><option value="space-around">Espacio alrededor</option><option value="flex-end">Final</option>
          </select>
        </label>
        <label className="ee-field"><span>Alinear elementos</span>
          <select className="ee-select" value={styles.alignItems ?? "stretch"} onChange={event => update("alignItems", event.target.value)}>
            <option value="stretch">Estirar</option><option value="center">Centro</option><option value="flex-start">Inicio</option><option value="flex-end">Final</option><option value="baseline">Línea base</option>
          </select>
        </label>
        <label className="ee-field"><span>Ajustar a otra línea</span>
          <select className="ee-select" value={styles.flexWrap ?? "nowrap"} onChange={event => update("flexWrap", event.target.value)}>
            <option value="nowrap">No</option><option value="wrap">Sí</option>
          </select>
        </label>
        {styles.flexWrap === "wrap" && <label className="ee-field"><span>Distribución de filas</span>
          <select className="ee-select" value={styles.alignContent ?? "stretch"} onChange={event => update("alignContent", event.target.value)}>
            <option value="stretch">Estirar</option><option value="flex-start">Inicio</option><option value="center">Centro</option><option value="space-between">Espacio entre</option><option value="space-around">Espacio alrededor</option>
          </select>
        </label>}
      </>}
    </div>
  </details>;
}
