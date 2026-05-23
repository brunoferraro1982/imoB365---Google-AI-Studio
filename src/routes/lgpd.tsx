import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "./index";

export const Route = createFileRoute("/lgpd")({
  head: () => ({
    meta: [
      { title: "LGPD — imob365" },
      { name: "description", content: "Conformidade da imob365 com a Lei Geral de Proteção de Dados." },
      { property: "og:title", content: "LGPD — imob365" },
      { property: "og:description", content: "Conformidade da imob365 com a Lei Geral de Proteção de Dados." },
    ],
  }),
  component: LgpdPage,
});

function LgpdPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">LGPD — Lei Geral de Proteção de Dados</h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Nosso compromisso com a proteção dos seus dados pessoais.
        </p>

        <div className="space-y-8 text-foreground/90">
          <section>
            <h2 className="mb-3 text-2xl font-semibold">O que é a LGPD?</h2>
            <p>
              A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) estabelece regras sobre coleta,
              armazenamento, tratamento e compartilhamento de dados pessoais, garantindo mais
              transparência, segurança e direitos aos titulares.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Nosso Compromisso</h2>
            <p>
              A imob365 está 100% em conformidade com a LGPD, adotando processos, ferramentas e cultura
              organizacional voltados à proteção dos dados pessoais de clientes, corretores, imobiliárias
              e demais usuários da plataforma.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Princípios Aplicados</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li><strong>Finalidade:</strong> tratamento para propósitos legítimos, específicos e informados;</li>
              <li><strong>Necessidade:</strong> coleta apenas dos dados estritamente necessários;</li>
              <li><strong>Transparência:</strong> informações claras sobre o tratamento realizado;</li>
              <li><strong>Segurança:</strong> medidas técnicas e administrativas adequadas;</li>
              <li><strong>Não discriminação:</strong> vedação ao uso para fins discriminatórios;</li>
              <li><strong>Responsabilização:</strong> demonstração da adoção de boas práticas.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Direitos dos Titulares</h2>
            <p>Conforme o art. 18 da LGPD, você pode solicitar a qualquer momento:</p>
            <ul className="ml-6 mt-2 list-disc space-y-2">
              <li>Confirmação da existência de tratamento;</li>
              <li>Acesso aos dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Portabilidade a outro fornecedor;</li>
              <li>Eliminação dos dados tratados com consentimento;</li>
              <li>Informação sobre compartilhamento;</li>
              <li>Revogação do consentimento.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Medidas de Segurança</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Criptografia de dados em trânsito e em repouso;</li>
              <li>Controle de acesso baseado em perfis e autenticação;</li>
              <li>Monitoramento contínuo e auditorias periódicas;</li>
              <li>Treinamento da equipe sobre proteção de dados;</li>
              <li>Plano de resposta a incidentes de segurança.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Encarregado pelo Tratamento de Dados (DPO)</h2>
            <p>
              Nosso DPO é o canal oficial para esclarecimento de dúvidas, solicitações de titulares e
              comunicação com a Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
            <p className="mt-2">
              Contato:{" "}
              <a className="text-primary underline" href="mailto:dpo@imob365.com.br">
                dpo@imob365.com.br
              </a>{" "}
              · (13) 99779-4382
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">Como Exercer seus Direitos</h2>
            <p>
              Envie sua solicitação para o e-mail do DPO informando seu nome completo, o direito que deseja
              exercer e os detalhes do pedido. Responderemos em até 15 dias, conforme previsto em lei.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}