import type { CompanyPackage } from "@shared/company-compilation";
import type { CompanySourceBinding } from "@shared/company-source-adapter";
import {
  compileEmpyreanReferenceInstance,
  EMPYREAN_COMPANY_PACKAGE,
} from "../reference-instances/empyrean-studios";
import {
  AFM_COMPANY_PACKAGE,
  AFM_SOURCE_BINDINGS,
  compileAfmReferenceInstance,
} from "../reference-instances/afm";

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
    sourceBindings: [],
    materialize: compileEmpyreanReferenceInstance,
  },
  {
    package: AFM_COMPANY_PACKAGE,
    sourceBindings: AFM_SOURCE_BINDINGS,
    materialize: compileAfmReferenceInstance,
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
