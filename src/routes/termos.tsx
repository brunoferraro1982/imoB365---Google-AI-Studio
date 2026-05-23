import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "./index";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — imob365" },
      { name: "description", content: "Termos e condições de uso da plataforma imob365." },
      { property: "og:title", content: "Termos de Uso — imob365" },
      { property: "og:description", content: "Termos e condições de uso da plataforma imob365." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="mb-10 text-sm text-muted-foreground">Última atualização: 21 de maio de 2026</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="mb-3 text-2xl font-semibold">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma imob365, você concorda integralmente com estes Termos de Uso.
              Caso não concorde com qualquer disposição, recomenda-se que não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">2. Descrição do Serviço</h2>
            <p>
              A imob365 é uma plataforma digital que conecta imobiliárias, corretores e clientes, oferecendo
              ferramentas para gestão, divulgação e negociação de imóveis para compra, venda e locação.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">3. Cadastro e Conta</h2>
            <p>
              Para utilizar funcionalidades específicas, o usuário deverá fornecer informações verdadeiras,
              completas e atualizadas. O usuário é o único responsável pela confidencialidade de sua senha
              e por todas as atividades realizadas em sua conta.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">4. Obrigações do Usuário</h2>
            <ul className="ml-6 list-disc space-y-2">
              <li>Utilizar a plataforma em conformidade com a legislação vigente;</li>
              <li>Não publicar conteúdo falso, ofensivo, ilegal ou que viole direitos de terceiros;</li>
              <li>Respeitar os direitos de propriedade intelectual da imob365 e de outros usuários;</li>
              <li>Manter seus dados cadastrais atualizados.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">5. Propriedade Intelectual</h2>
            <p>
              Todos os direitos relativos à plataforma, incluindo marca, logotipo, design, código-fonte e
              conteúdos, são de propriedade exclusiva da imob365 ou de seus licenciadores.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">6. Limitação de Responsabilidade</h2>
            <p>
              A imob365 atua como intermediadora entre as partes interessadas em transações imobiliárias e
              não se responsabiliza pela veracidade dos anúncios publicados por terceiros nem pelo resultado
              das negociações realizadas entre usuários.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">7. Suspensão e Encerramento</h2>
            <p>
              A imob365 reserva-se o direito de suspender ou encerrar contas que violem estes Termos ou a
              legislação aplicável, a qualquer tempo e sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">8. Alterações dos Termos</h2>
            <p>
              Estes Termos podem ser atualizados periodicamente. As alterações entram em vigor a partir da
              publicação na plataforma, sendo de responsabilidade do usuário consultá-los regularmente.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">9. Foro</h2>
            <p>
              Fica eleito o foro da comarca de Santos/SP para dirimir quaisquer controvérsias decorrentes
              destes Termos, com renúncia de qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold">10. Contato</h2>
            <p>
              Em caso de dúvidas, entre em contato pelo e-mail{" "}
              <a className="text-primary underline" href="mailto:contato@imob365.com.br">
                contato@imob365.com.br
              </a>{" "}
              ou pelo telefone (13) 99779-4382.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}