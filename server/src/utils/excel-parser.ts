import * as XLSX from 'xlsx';
import path from 'path';

export interface ParsedModule {
  code: string;
  name: string;
  units: ParsedUnit[];
  totalHoursAula: number;
  totalHoursWebinar: number;
  totalHoursFad: number;
  totalHoursPw: number;
  totalHoursStage: number;
}

export interface ParsedUnit {
  name: string;
  teacherName: string;
  contractedHours: number;
  locationType: string;
}

export function parseExcelFile(filePath: string): ParsedModule[] {
  const workbook = XLSX.readFile(filePath);

  // Try to find the sheet
  let sheetName = '1 ANNO 25225';
  if (!workbook.SheetNames.includes(sheetName)) {
    // Try first sheet
    sheetName = workbook.SheetNames[0];
    console.log(`Sheet '1 ANNO 25225' not found, using '${sheetName}'`);
  }

  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log(`📊 Parsing sheet '${sheetName}' with ${data.length} rows`);

  const modules: ParsedModule[] = [];
  let currentModule: ParsedModule | null = null;

  // Parse module definitions from the first ~40 rows
  for (let i = 0; i < Math.min(data.length, 50); i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || '').trim();

    // Check if this is a module header row (starts with "Mod.")
    const modMatch = firstCell.match(/^Mod\.?\s*(\d+)/i);
    if (modMatch) {
      // Save previous module
      if (currentModule) {
        modules.push(currentModule);
      }

      const modCode = `Mod.${modMatch[1]}`;
      const modName = String(row[1] || '').trim();

      currentModule = {
        code: modCode,
        name: modName,
        units: [],
        totalHoursAula: 0,
        totalHoursWebinar: 0,
        totalHoursFad: 0,
        totalHoursPw: 0,
        totalHoursStage: 0,
      };

      // Parse hour columns
      // Typical layout: col index varies, but generally:
      // [Code, Name, UnitName, Aula, Webinar, FAD, PW, Stage, Teacher, TotalHours, ...]
      const aulaHours = parseFloat(row[3]) || 0;
      const webinarHours = parseFloat(row[4]) || 0;
      const fadHours = parseFloat(row[5]) || 0;
      const pwHours = parseFloat(row[6]) || 0;
      const stageHours = parseFloat(row[7]) || 0;

      currentModule.totalHoursAula = aulaHours;
      currentModule.totalHoursWebinar = webinarHours;
      currentModule.totalHoursFad = fadHours;
      currentModule.totalHoursPw = pwHours;
      currentModule.totalHoursStage = stageHours;

      // Extract unit info from this row
      const unitName = String(row[2] || modName).trim();
      const teacherName = String(row[8] || '').trim();
      const totalHours = parseFloat(row[9]) || (aulaHours + webinarHours + fadHours + pwHours + stageHours);

      // Determine primary location type
      let locationType = 'AULA';
      if (webinarHours > 0 && webinarHours >= aulaHours) locationType = 'WEBINAR';
      if (fadHours > 0 && fadHours >= aulaHours) locationType = 'FAD';

      if (unitName || teacherName) {
        currentModule.units.push({
          name: unitName || modName,
          teacherName: teacherName || 'Da assegnare',
          contractedHours: totalHours,
          locationType
        });
      }

      continue;
    }

    // Check if this row is a sub-unit of the current module
    if (currentModule) {
      const unitName = String(row[2] || '').trim();
      const teacherName = String(row[8] || '').trim();
      const totalHours = parseFloat(row[9]) || 0;

      if (unitName && totalHours > 0) {
        // Determine type from individual hour columns
        const aulaH = parseFloat(row[3]) || 0;
        const webinarH = parseFloat(row[4]) || 0;
        const fadH = parseFloat(row[5]) || 0;

        let locationType = 'AULA';
        if (webinarH > aulaH) locationType = 'WEBINAR';
        if (fadH > aulaH) locationType = 'FAD';

        // Add aula/webinar/fad hours to the module total if present in sub-row
        if (aulaH > 0) currentModule.totalHoursAula += aulaH;
        if (webinarH > 0) currentModule.totalHoursWebinar += webinarH;
        if (fadH > 0) currentModule.totalHoursFad += fadH;

        currentModule.units.push({
          name: unitName,
          teacherName: teacherName || 'Da assegnare',
          contractedHours: totalHours,
          locationType
        });
      }
    }
  }

  // Don't forget the last module
  if (currentModule) {
    modules.push(currentModule);
  }

  console.log(`📋 Parsed ${modules.length} modules:`);
  modules.forEach(m => {
    console.log(`  ${m.code}: ${m.name} (${m.units.length} units, Aula:${m.totalHoursAula}h, Web:${m.totalHoursWebinar}h, FAD:${m.totalHoursFad}h, PW:${m.totalHoursPw}h, Stage:${m.totalHoursStage}h)`);
    m.units.forEach(u => {
      console.log(`    - ${u.name}: ${u.contractedHours}h, Teacher: ${u.teacherName}, Type: ${u.locationType}`);
    });
  });

  return modules;
}
