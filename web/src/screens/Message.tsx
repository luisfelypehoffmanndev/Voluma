type Props = {
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
};

/** Tela de uma frase so: carregando, sem acesso, erro. */
export function Message({ title, detail, action }: Props) {
  return (
    <main className="center">
      <div className="center-box">
        <h1 className="title">{title}</h1>
        {detail ? <p className="muted">{detail}</p> : null}
        {action ? (
          <button className="button" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    </main>
  );
}
