/* eslint-disable @next/next/no-img-element */
import Pricing from '@/components/landing/Pricing';
import Shop from '@/components/landing/Shop';
import ContactForm from '@/components/landing/ContactForm';
import Particles from '@/components/landing/Particles';
import Motion from '@/components/landing/Motion';
import Ribbon from '@/components/landing/Ribbon';
import { CartProvider } from '@/components/landing/cart';
import { TrackForm } from '@/components/landing/Track';
import { DailyPriceChart, QuotaChart } from '@/components/landing/Charts';
import '@/styles/site/site.css';

const TAPE = ['Stratégie', 'Création', 'Production', 'Media buying', 'Identité', 'Audiovisuel', 'Événementiel', 'Reporting'];

const PILLARS = [
  ['Concevoir', 'Un concept clair et un plan d’action structuré.'],
  ['Orchestrer', 'Équipes et partenaires autour d’une direction commune.'],
  ['Produire', 'La mise en œuvre, fidèle au dispositif défini.'],
  ['Piloter', 'Suivi, ajustements et cohérence d’ensemble.'],
];

const STEPS = [
  ['Votre panier', 'Vous composez votre besoin en ligne : formule, services, devis.'],
  ['Appel du conseiller', 'Nous analysons, échangeons et chiffrons ce qui est sur devis.'],
  ['Contrat et lancement', 'Vous signez, la première mensualité lance le projet.'],
  ['Production et validation', 'Vous validez chaque livrable avant publication.'],
  ['Résultats', 'Tableau de bord et rapport mensuel de performance.'],
];

const ICON: Record<string, string> = {
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12',
  form: 'M9 3h6v3H9zM6 5h3M15 5h3v16H6V5M9 11h6M9 15h4',
  crm: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  chat: 'M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  lead: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-3.3 3.1-6 7-6s7 2.7 7 6M16 11l2 2 4-4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
};
const LEADS: [string, string, string][] = [
  ['megaphone', 'Meta Ads', 'Attirer des prospects qualifiés.'],
  ['form', 'Formulaire', 'Collecter les informations clés.'],
  ['crm', 'CRM', 'Centraliser chaque lead.'],
  ['chat', 'WhatsApp', 'Contacter et relancer.'],
  ['lead', 'Clients', 'Convertir les prospects.'],
  ['chart', 'Reporting', 'Mesurer et optimiser.'],
];

const LEVELS: [string, string, string, string][] = [
  ['Audit digital et analyse concurrentielle', 'in', 'in', 'in'],
  ['Stratégie de communication', 'in', 'in', 'in'],
  ['Stratégie éditoriale', 'in', 'in', 'in'],
  ['Formation et montée en compétences', 'no', 'in', 'opt'],
  ['Création des contenus', 'cl', 'in', 'in'],
  ['Publication et animation', 'cl', 'cl', 'in'],
  ['Campagnes publicitaires', 'cl', 'in', 'in'],
  ['Reporting et optimisation', 'cl', 'cl', 'in'],
];
const cell = (v: string) =>
  v === 'in' ? <span className="cell-in">IN COM</span>
  : v === 'opt' ? <span className="cell-opt">Selon besoins</span>
  : v === 'cl' ? <span className="cell-cl">Votre équipe</span>
  : <span className="cell-cl">Non inclus</span>;

const ECO = [
  ['IN ACADEMY', 'Les entreprises formées deviennent clientes.'],
  ['IN-CUBATOR', 'Les startups accompagnées se lancent avec nous.'],
  ['IN PAY', 'Paiement et facturation intégrés.'],
  ['IN DEV', 'Sites, CRM et assistants IA.'],
  ['IN EVENT', 'Pilotage des événements.'],
];

function Tape({ reverse = false }: { reverse?: boolean }) {
  return (
    <div className={`tape ${reverse ? 'rev' : ''}`} aria-hidden="true">
      <div className="tape-run">
        {[0, 1].map((k) => (
          <span key={k}>{[...TAPE, ...TAPE].map((w, i) => <span key={i}>{w}<i>✶</i></span>)}</span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="site">
      <CartProvider>
        <Motion />
        <div className="page-progress" aria-hidden="true" />

        <header className="nav">
          <div className="container">
            <a href="/" className="brand" aria-label="IN COMMUNICATION, accueil">
              <img className="on-dark" src="/brand/logo-light.png" alt="IN COMMUNICATION" width={994} height={1092} />
              <img className="on-light" src="/brand/logo.png" alt="" width={994} height={1092} />
            </a>
            <nav aria-label="Navigation principale">
              <ul>
                <li><a href="#expertises">Expertises</a></li>
                <li><a href="#methode">Méthode</a></li>
                <li><a href="#offres">Offres</a></li>
                <li><a href="/suivi">Suivi</a></li>
                <li><a href="#contact">Contact</a></li>
              </ul>
            </nav>
            <div className="actions">
              <a href="/connexion" className="btn btn-line btn-sm hide-s">Espace client</a>
              <span data-cart-slot />
            </div>
          </div>
        </header>

        <main>
          {/* ───────── Hero : logo en particules ───────── */}
          <section className="hero" aria-labelledby="hero-title">
            <Particles />
            <div className="hero-glow" aria-hidden="true" />
            <div className="container hero-inner">
              <h1 id="hero-title" className="hero-title">
                <span className="ln"><span>Des idées</span></span>
                <span className="ln"><span className="outline">qui prennent</span></span>
                <span className="ln"><span className="hot">vie.</span></span>
              </h1>
              <div className="hero-side">
                <p className="lead">Stratégie, création, production et événementiel à Alger. Composez votre panier en ligne, suivez chaque étape, validez chaque contenu.</p>
                <div className="ctas">
                  <a href="#offres" className="btn btn-accent" data-magnet>Composer mon panier</a>
                  <a href="/suivi" className="btn btn-line">Suivre une commande</a>
                </div>
              </div>
              <ul className="hero-stats">
                <li><b data-count="7">7</b><span>métiers sous un même toit</span></li>
                <li><span className="nb"><b data-count="100">100</b>%</span><span>des contenus validés par vous</span></li>
                <li><span className="nb"><b data-count="24">24</b>h</span><span>pour vous rappeler</span></li>
              </ul>
            </div>
            <a href="#manifeste" className="scroll-hint" aria-label="Défiler vers la suite"><span /></a>
          </section>

          <div className="tapes">
            <Tape />
            <Tape reverse />
          </div>

          {/* ───────── Manifeste ───────── */}
          <section className="section manifesto" id="manifeste" data-progress aria-label="Notre approche">
            <div className="container">
              <p className="statement" data-words>Un seul interlocuteur, un seul espace, des résultats que vous voyez chaque mois.</p>
              <ol className="pillars">
                {PILLARS.map(([t, d], i) => (
                  <li key={t} data-reveal style={{ ['--i' as string]: i }}>
                    <span className="pn">0{i + 1}</span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ───────── Écran client qui se redresse ───────── */}
          <section className="screen-sec" data-progress aria-labelledby="screen-title">
            <div className="container">
              <div className="head center" data-reveal>
                <h2 id="screen-title">Tout se passe dans <em>votre espace.</em></h2>
                <p className="lead">Chaque post attend votre validation. Chaque commande a sa page de suivi. Chaque mois, un rapport clair.</p>
              </div>
              <div className="screen-3d">
                <div className="screen">
                  <img src="/screens/client-validation.png" alt="L’espace client IN COM : les posts en attente de validation, validés et publiés" width={1440} height={900} loading="lazy" />
                </div>
                <div className="phone"><img src="/screens/client-phone.png" alt="" width={390} height={844} loading="lazy" /></div>
                <span className="float f1">✓ Post validé</span>
                <span className="float f2">Paiement confirmé</span>
                <span className="float f3"><i /> Publié sur Instagram</span>
              </div>
            </div>
          </section>

          {/* ───────── Métiers : ruban 3D ───────── */}
          <Ribbon />

          {/* ───────── Méthode ───────── */}
          <section className="section method" id="methode" aria-labelledby="meth-title">
            <div className="container">
              <div className="head split" data-reveal>
                <h2 id="meth-title">Du panier <em>aux résultats.</em></h2>
                <p className="lead">Que la prestation soit réalisée par nos équipes ou par un partenaire, vous suivez tout depuis le même espace, avec votre chargé de clientèle.</p>
              </div>
              <div className="journey">
                <div className="steps-wrap" data-progress>
                  <span className="steps-line" aria-hidden="true" />
                  <ol className="steps">
                    {STEPS.map(([t, d], i) => (
                      <li key={t} data-reveal>
                        <span className="sn">{i + 1}</span>
                        <div><h3>{t}</h3><p>{d}</p></div>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="visual" data-reveal>
                  <div className="shot tilt">
                    <img src="/screens/resp-com-dashboard.png" alt="Le tableau de bord interne : clients actifs, paiements à vérifier, dossiers en création et en validation" width={1440} height={900} loading="lazy" />
                  </div>
                  <ol className="flow" aria-label="Circuit d’un dossier dans notre CRM">
                    {['Signé', 'Paiement confirmé', 'Création', 'Validation', 'Publié'].map((s, i) => (
                      <li key={s} style={{ ['--i' as string]: i }}><b>{s}</b></li>
                    ))}
                  </ol>
                  <p className="flow-note">Le circuit de chaque dossier dans notre CRM : aucune production ne démarre sans paiement confirmé.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ───────── Offres + boutique ───────── */}
          <section className="section offers" id="offres" aria-labelledby="off-title">
            <div className="container">
              <div className="head split" data-reveal>
                <h2 id="off-title">Un abonnement <em>qui s’occupe de tout.</em></h2>
                <p className="lead">Choisissez une formule, ajoutez des services à la carte, envoyez votre panier. Un conseiller confirme avec vous avant toute facturation.</p>
              </div>
              <Pricing />

              <div className="shop-head" data-reveal>
                <h3>À la carte</h3>
                <p>Des services à prix fixe, à ajouter à votre formule ou à commander seuls.</p>
              </div>
              <Shop />

              <div className="charts">
                <QuotaChart />
                <DailyPriceChart />
              </div>

              <ul className="notes" data-reveal>
                <li>Budget publicitaire à la charge du client, distinct des honoraires.</li>
                <li>Nom de domaine à la charge du client ; hébergement du site gratuit.</li>
                <li>Logo, photos et textes de base fournis par le client, sinon en supplément.</li>
                <li>Cabinet médical : l’assistant IA oriente vers un rendez-vous, sans diagnostic.</li>
              </ul>
            </div>
          </section>

          {/* ───────── Leads ───────── */}
          <section className="section dark leads-sec" id="leads" aria-labelledby="lead-title">
            <div className="container">
              <div className="head split" data-reveal>
                <h2 id="lead-title">De la publicité <em>à la conversion.</em></h2>
                <p className="lead">Nous concevons et pilotons vos campagnes Meta Ads, puis nous suivons chaque lead jusqu’au client.</p>
              </div>
              <ol className="leads" data-reveal aria-label="Parcours d’un lead, de la publicité au reporting">
                {LEADS.map(([icon, t, d], i) => (
                  <li key={t} style={{ ['--i' as string]: i }}>
                    <span className="node"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[icon]} /></svg></span>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </li>
                ))}
              </ol>
              <div className="fees" data-reveal>
                <p className="claim">Notre priorité : la qualité des leads, pas seulement leur coût.</p>
                <dl>
                  <div><dt>Frais mensuels de gestion</dt><dd>Pilotage, gestion et optimisation des campagnes, chaque mois.</dd></div>
                  <div><dt>Budget publicitaire de diffusion</dt><dd>Défini en montant journalier, à la charge du client et distinct de nos honoraires.</dd></div>
                </dl>
              </div>
            </div>
          </section>

          {/* ───────── Niveaux ───────── */}
          <section className="section" id="niveaux" aria-labelledby="lvl-title">
            <div className="container">
              <div className="head split" data-reveal>
                <h2 id="lvl-title">Trois niveaux <em>d’accompagnement.</em></h2>
                <p className="lead">Du conseil stratégique seul à la délégation complète, vous choisissez la part que vous gardez en interne.</p>
              </div>
              <div className="levels-wrap" data-reveal>
                <table className="levels">
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col"><b>Niveau 1</b>Nous définissons, votre équipe exécute.</th>
                      <th scope="col"><b>Niveau 2</b>Nous exécutons avec votre équipe.</th>
                      <th scope="col"><b>Niveau 3</b>Nous prenons tout en charge.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEVELS.map(([s, a, b, c]) => <tr key={s}><td>{s}</td><td>{cell(a)}</td><td>{cell(b)}</td><td>{cell(c)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ───────── Suivi ───────── */}
          <section className="track-band" aria-labelledby="trk-title">
            <div className="container">
              <div data-reveal>
                <h2 id="trk-title">Déjà commandé ?<br /><em>Suivez chaque étape.</em></h2>
                <p className="lead">Votre code de suivi vous est donné à l’envoi du panier. Reçue, conseiller en contact, confirmée, en production, livrée : vous savez toujours où en est votre projet.</p>
              </div>
              <TrackForm dark />
            </div>
          </section>

          {/* ───────── Contact ───────── */}
          <section className="section contact" id="contact" aria-labelledby="ct-title">
            <div className="container grid12">
              <div className="contact-text" data-reveal>
                <h2 id="ct-title">Parlons de <em>votre projet.</em></h2>
                <p className="lead">Pas encore sûr de la formule ? Un conseiller vous rappelle pour comprendre votre besoin et vous orienter.</p>
                <dl>
                  <div><dt>Adresse</dt><dd>Alger, Algérie</dd></div>
                  <div><dt>Horaires</dt><dd>Du dimanche au jeudi, de 9 h à 17 h</dd></div>
                  <div><dt>Déjà client</dt><dd><a href="/connexion" className="link">Ouvrir mon espace client</a></dd></div>
                </dl>
              </div>
              <ContactForm />
            </div>
          </section>
        </main>

        <footer className="foot" data-progress>
          <div className="container">
            <div className="foot-top">
              <img src="/brand/logo-light.png" alt="" width={994} height={1092} loading="lazy" />
              <p className="foot-cta">Une idée ? <a href="#offres" className="link">Composez votre panier</a> ou <a href="#contact" className="link">écrivez-nous</a>.</p>
            </div>
            <ul className="eco">
              {ECO.map(([t, d]) => <li key={t}><b>{t}</b><span>{d}</span></li>)}
            </ul>
          </div>
          <p className="wordmark" aria-hidden="true">IN COMMUNICATION</p>
          <div className="container">
            <div className="bottom">
              <span>© {new Date().getFullYear()} IN COMMUNICATION, La Maison IN Groupe</span>
              <ul>
                <li><a href="#expertises">Expertises</a></li>
                <li><a href="#offres">Offres</a></li>
                <li><a href="/suivi">Suivi de commande</a></li>
                <li><a href="/connexion">Espace client</a></li>
              </ul>
            </div>
          </div>
        </footer>
      </CartProvider>
    </div>
  );
}
