import type { CompanyPackage } from "@shared/company-compilation";
import type { CompanySourceBinding } from "@shared/company-source-adapter";
import {
  compileEmpyreanReferenceInstance,
  EMPYREAN_COMPANY_PACKAGE,
  EMPYREAN_SOURCE_BINDINGS,
} from "../reference-instances/empyrean-studios";
import {
  AFM_COMPANY_PACKAGE,
  AFM_SOURCE_BINDINGS,
  compileAfmReferenceInstance,
} from "../reference-instances/afm";
import {
  LYFE_INSTITUTE_COMPANY_PACKAGE,
  LYFE_INSTITUTE_SOURCE_BINDINGS,
  compileLyfeInstituteReferenceInstance,
} from "../reference-instances/lyfe-institute";
import {
  LYFE_SPECTRUM_COMPANY_PACKAGE,
  LYFE_SPECTRUM_SOURCE_BINDINGS,
  compileLyfeSpectrumReferenceInstance,
} from "../reference-instances/lyfe-spectrum";
import {
  OST_COMPANY_PACKAGE,
  OST_SOURCE_BINDINGS,
  compileOstReferenceInstance,
} from "../reference-instances/ost";

export type CompanyPackageCompileInput = {
  companyId: number;
  actorUserId: string;
  actorName: string;
};

export type CompanyPackageMaterializationResult = {
  created: boolean;
  company: Record<string, unknown>;
  manifest: Record<string, unknown>;
  report: Record<string, unknown>;
};

export type RegisteredCompanyPackage = {
  package: CompanyPackage;
  sourceBindings: CompanySourceBinding[];
  materialize: (
    executor: any,
    input: CompanyPackageCompileInput,
  ) => Promise<CompanyPackageMaterializationResult>;
};

const registeredPackages: RegisteredCompanyPackage[] = [
  {
    package: EMPYREAN_COMPANY_PACKAGE,
    sourceBindings: EMPYREAN_SOURCE_BINDINGS,
    materialize: compileEmpyreanReferenceInstance,
  },
  {
    package: AFM_COMPANY_PACKAGE,
    sourceBindings: AFM_SOURCE_BINDINGS,
    materialize: compileAfmReferenceInstance,
  },
  {
    package: OST_COMPANY_PACKAGE,
    sourceBindings: OST_SOURCE_BINDINGS,
    materialize: compileOstReferenceInstance,
  },
  {
    package: LYFE_INSTITUTE_COMPANY_PACKAGE,
    sourceBindings: LYFE_INSTITUTE_SOURCE_BINDINGS,
    materialize: compileLyfeInstituteReferenceInstance,
  },
  {
    package: LYFE_SPECTRUM_COMPANY_PACKAGE,
    sourceBindings: LYFE_SPECTRUM_SOURCE_BINDINGS,
    materialize: compileLyfeSpectrumReferenceInstance,
  },
];

function normalizedCompanyName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function companyMatchesPackage(
  companyName: string,
  packageDefinition: CompanyPackage,
): boolean {
  const normalized = normalizedCompanyName(companyName);
  return packageDefinition.targetCompanyAliases.some(
    (alias) => normalizedCompanyName(alias) === normalized,
  );
}

export function getRegisteredCompanyPackage(
  packageKey: string,
): RegisteredCompanyPackage | undefined {
  return registeredPackages.find(
    (registration) => registration.package.packageKey === packageKey,
  );
}

export function listRegisteredCompanyPackages(): RegisteredCompanyPackage[] {
  return [...registeredPackages];
}

export function applicableCompanyPackages(companyName: string) {
  return registeredPackages.filter((registration) =>
    companyMatchesPackage(companyName, registration.package),
  );
}
