import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Secteur } from '../entities/secteur.entity';
import { CreateSecteurDto, UpdateSecteurDto } from './dto/create-secteur.dto';

const SEED_SECTEURS: Omit<Secteur, 'id' | 'createdAt' | 'updatedAt' | 'questions'>[] = [
  { code: 'RESTAURATION',        label: 'Hôtellerie-Restauration & Métiers de bouche', icon: 'restaurant',        codeNaf: '56.10A', codeNafLibelle: 'Restaurants et services de restauration mobile', isActive: true },
  { code: 'BTP',                 label: 'BTP',                                           icon: 'construction',      codeNaf: '43.99C', codeNafLibelle: 'Travaux de construction spécialisés', isActive: true },
  { code: 'ASSOCIATION',         label: 'Association',                                   icon: 'volunteer_activism', codeNaf: '94.99Z', codeNafLibelle: 'Autres organisations fonctionnant par adhésion volontaire', isActive: true },
  { code: 'HOLDING',             label: 'Holding & Groupes',                             icon: 'account_tree',      codeNaf: '64.20Z', codeNafLibelle: 'Activités des sociétés holding', isActive: true },
  { code: 'PROFESSION_LIBERALE', label: 'Profession Libérale',                           icon: 'medical_services',  codeNaf: '69.10Z', codeNafLibelle: 'Activités juridiques', isActive: true },
  { code: 'SCI',                 label: 'SCI (Société Civile Immobilière)',               icon: 'apartment',         codeNaf: '68.20A', codeNafLibelle: 'Location de logements', isActive: true },
  { code: 'COMMERCE',            label: 'Commerce de détail & Distribution',             icon: 'storefront',        codeNaf: '47.11B', codeNafLibelle: 'Commerce de détail', isActive: true },
  { code: 'TRANSPORT',           label: 'Transport & Logistique',                        icon: 'local_shipping',    codeNaf: '49.41A', codeNafLibelle: 'Transports routiers de fret', isActive: true },
  { code: 'SANTE',               label: 'Santé & Médico-social',                         icon: 'local_hospital',    codeNaf: '86.10Z', codeNafLibelle: 'Activités hospitalières', isActive: true },
  { code: 'AGRICULTURE',         label: 'Agriculture & Agroalimentaire',                 icon: 'eco',               codeNaf: '01.11Z', codeNafLibelle: 'Culture de céréales (sauf riz), légumineuses et graines oléagineuses', isActive: true },
  { code: 'SERVICES',            label: 'Services aux entreprises',                      icon: 'business_center',   codeNaf: '82.11Z', codeNafLibelle: 'Services administratifs combinés de bureau', isActive: true },
  { code: 'NUMERIQUE',           label: 'Numérique & Tech',                              icon: 'computer',          codeNaf: '62.01Z', codeNafLibelle: 'Programmation informatique', isActive: true },
];

@Injectable()
export class SecteursService {
  constructor(
    @InjectRepository(Secteur) private repo: Repository<Secteur>,
  ) {}

  async onModuleInit() {
    const count = await this.repo.count();
    if (count === 0) {
      for (const s of SEED_SECTEURS) {
        await this.repo.save(this.repo.create({ ...s, questions: [] }));
      }
    }
  }

  findAll(includeInactive = false): Promise<Secteur[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.repo.find({ where, order: { label: 'ASC' } });
  }

  async findOne(id: number): Promise<Secteur> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`Secteur #${id} introuvable`);
    return s;
  }

  async create(dto: CreateSecteurDto): Promise<Secteur> {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Code secteur '${dto.code}' déjà utilisé`);
    return this.repo.save(this.repo.create({ ...dto, questions: dto.questions ?? [] }));
  }

  async update(id: number, dto: UpdateSecteurDto): Promise<Secteur> {
    const secteur = await this.findOne(id);
    Object.assign(secteur, dto);
    return this.repo.save(secteur);
  }

  async remove(id: number): Promise<void> {
    const secteur = await this.findOne(id);
    secteur.isActive = false;
    await this.repo.save(secteur);
  }

  /** Synchronise le libellé NAF d'un secteur via l'API recherche-entreprises.api.gouv.fr */
  async syncNaf(id: number): Promise<Secteur> {
    const secteur = await this.findOne(id);
    if (!secteur.codeNaf) return secteur;

    try {
      const url = `https://recherche-entreprises.api.gouv.fr/search?activite_principale=${encodeURIComponent(secteur.codeNaf)}&limit=1`;
      const response = await fetch(url);
      if (!response.ok) return secteur;
      const data = (await response.json()) as { results?: { libelle_activite_principale_entreprise?: string }[] };
      const libelle = data.results?.[0]?.libelle_activite_principale_entreprise;
      if (libelle) {
        secteur.codeNafLibelle = libelle;
        return this.repo.save(secteur);
      }
    } catch {
      // silencieux — si l'API est indisponible on garde l'ancienne valeur
    }
    return secteur;
  }

  /** Synchronise tous les secteurs actifs qui ont un code NAF */
  async syncAllNaf(): Promise<{ synced: number; errors: number }> {
    const secteurs = await this.repo.find({ where: { isActive: true } });
    let synced = 0;
    let errors = 0;
    for (const s of secteurs) {
      if (!s.codeNaf) continue;
      try {
        await this.syncNaf(s.id);
        synced++;
      } catch {
        errors++;
      }
    }
    return { synced, errors };
  }
}
