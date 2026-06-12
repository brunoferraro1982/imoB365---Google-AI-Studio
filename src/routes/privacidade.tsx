import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-layout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — imob365" },
      {
        name: "description",
        content: "Como a imob365 coleta, utiliza e protege seus dados pessoais.",
      },
      { property: "og:title", content: "Política de Privacidade — imob365" },
      {
        property: "og:description",
        content: "Como a imob365 coleta, utiliza e protege seus dados pessoais.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Última atualização: 21 de maio de 2026
        </p>

        <div className="space-y-8 text-foreground/90">
          <section>
            <h2 className="mb-3 text-2xl font-semibold">1. Compromisso com a Privacidade</h2>
            <p>
              A imob365 valoriza a privacidade dos seus usuários e adota as melhores práticas para
              garantir a segurança e o tratamento adequado dos dados pessoais coletados, em
              conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">2. Dados Coletados</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <strong>Dados cadastrais:</strong> nome, e-mail, telefone, CPF/CNPJ, endereço;
              </li>
              <li>
                <strong>Dados de navegação:</strong> endereço IP, tipo de dispositivo, páginas
                acessadas;
              </li>
              <li>
                <strong>Dados de imóveis:</strong> informações fornecidas para anúncios e propostas;
              </li>
              <li>
                <strong>Cookies:</strong> para melhorar a experiência e personalizar o conteúdo.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">3. Finalidade do Tratamento</h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="ml-6 mt-2 list-disc space-y-2">
              <li>Permitir o uso adequado da plataforma e seus recursos;</li>
              <li>Viabilizar a intermediação entre clientes, corretores e imobiliárias;</li>
              <li>Enviar comunicações sobre serviços, novidades e ofertas;</li>
              <li>Cumprir obrigações legais e regulatórias;</li>
              <li>Prevenir fraudes e garantir a segurança da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">4. Compartilhamento de Dados</h2>
            <p>
              Seus dados poderão ser compartilhados com imobiliárias e corretores parceiros para
              viabilizar negociações, com prestadores de serviços tecnológicos contratados pela
              imob365 e com autoridades públicas quando exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">5. Armazenamento e Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acessos
              não autorizados, perda, alteração ou destruição. Os dados são armazenados em ambiente
              seguro pelo período necessário ao cumprimento das finalidades descritas.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">6. Direitos do Titular</h2>
            <p>Você tem direito a, a qualquer momento:</p>
            <ul className="ml-6 mt-2 list-disc space-y-2">
              <li>Confirmar a existência de tratamento dos seus dados;</li>
              <li>Acessar, corrigir ou atualizar seus dados;</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação;</li>
              <li>Solicitar a portabilidade dos dados;</li>
              <li>Revogar consentimento dado anteriormente.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">7. Cookies</h2>
            <p>
              Utilizamos cookies para melhorar a navegação, lembrar preferências e analisar o uso da
              plataforma. Você pode gerenciar as preferências de cookies nas configurações do seu
              navegador.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">8. Contato</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas, contate nosso Encarregado pelo
              Tratamento de Dados (DPO) pelo e-mail{" "}
              <a className="text-primary underline" href="mailto:dpo@imob365.com.br">
                dpo@imob365.com.br
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
