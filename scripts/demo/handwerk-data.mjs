import { createHash } from 'node:crypto';

export const demoName = 'Nordwerk Handwerk - Demo';
export const demoModules = ['jobs', 'reports', 'time_tracking', 'billing', 'inventory', 'logbook', 'customer_portal', 'dispatch', 'documents', 'ai', 'integrations'];
export const assetFiles = ['ferienhaus.jpg', 'servicewagen.jpg', 'kueche.jpg'];
export const fixtureUuid = value => {
  const hash = createHash('sha256').update(`workcore-handwerk-v1:${value}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
};

// Entirely invented records. No production snapshot is used as an input.
export function handwerkData(tenant, actor, today = '2026-10-24') {
  const rows = [];
  const add = (table, values) => { rows.push({ table: `homecare_${table}`, row: { tenant_id: tenant, ...values } }); };
  const day = offset => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10); };
  const at = (offset, hour) => `${day(offset)}T${String(hour).padStart(2,'0')}:00:00+02:00`;
  const customerNames = ['Familie Lindholm', 'Bergblick Ferienhaeuser', 'Cafe Birke', 'Hausgemeinschaft Seeblick', 'Familie Sommer'];
  customerNames.forEach((name, i) => {
    add('customers', { id: `DEMO-K${i+1}`, name, company_name: i === 1 || i === 2 ? name : '', personal_number: `D00${i+1}`, email: `kunde${i+1}@example.invalid`, language: 'Deutsch', address: `Demoweg ${i+1}, 00000 Musterort`, notes: 'Fiktiver Kunde fuer Vorfuehrungen. Keine echte Zustellung.', portal_status: 'einladen' });
    add('customer_contacts', { id: `DEMO-KON${i+1}`, customer_id: `DEMO-K${i+1}`, name: ['Anna Lindholm','Jonas Berg','Mia Birke','Lena Seeblick','Paul Sommer'][i], role: 'Ansprechpartner', email: `kontakt${i+1}@example.invalid`, is_primary: true });
  });
  const staff = [['Alex','Nord','Betriebsleitung'],['Mia','Berg','Tischlerin'],['Jonas','Lind','Monteur'],['Lena','Holm','Buero']];
  staff.forEach(([first_name,last_name,role],i) => add('personnel',{id:`DEMO-MA${i+1}`,personnel_number:`D-P00${i+1}`,first_name,last_name,role,email:`mitarbeiter${i+1}@example.invalid`,language:'Deutsch',status:'aktiv',notes:'Fiktiver Mitarbeiter; kein separater Login.'}));
  const objects = [
    ['Ferienhaus am See', 'Objekt', 1, 'Terrassenbau und laufende Betreuung', 95],
    ['Kuechenumbau Birkenweg', 'Projekt', 5, 'Montage einer neuen Einbaukueche', 110],
    ['Cafe Birke - Innenausbau', 'Projekt', 3, 'Innenausbau und Wartung', 160],
    ['Wohnanlage Seeblick', 'Objekt', 4, 'Hausmeisterservice und Gartenpflege', 240],
  ];
  objects.forEach(([name,object_type,customer,note,size],i) => add('objects',{id:`DEMO-O${i+1}`,name,object_type,owner_customer_id:`DEMO-K${customer}`,owner_name:customerNames[customer-1],address:`Demoweg ${customer}, 00000 Musterort`,region:'Demo-Region',size_sqm:size,rooms:4,beds:4,bathrooms:1,care_package:'Individuell',status:'aktiv',access_notes:note,next_visit:day(2),last_visit:day(-2)}));
  [['3051','Leistungen','Handwerksleistungen'],['3058','Material','Materialverkauf'],['4010','Einkauf','Materialeinkauf']].forEach(([account,category,label])=>add('accounting_accounts',{account,category,label}));
  const services = [['Tischlerarbeiten','Montage',685],['Montage und Reparatur','Montage',620],['Garten- und Objektpflege','Pflege',520],['Anfahrt','Anfahrt',180]];
  services.forEach(([name,category,price],i)=>add('services',{id:`DEMO-L${i+1}`,name,category,price,unit:i===3?'Pauschale':'Stunde',currency:'SEK',tax_rate:25,accounting_account:'3051',description:'Fiktive Demo-Leistung',show_work_time_in_reports:true,checklist:[{id:`DEMO-TASK${i+1}`,title:i===2?'Aussenbereich pruefen':'Arbeiten ausfuehren und Ergebnis pruefen'}]}));
  const resourceSpecs = [['Servicewagen Nord','Fahrzeug','vehicle','DEMO-01'],['Montagebus Sued','Fahrzeug','vehicle','DEMO-02'],['Aufsitzrasenmaeher','Maschine','machine','D-RM01'],['Akkuschrauber-Set','Geraet','tool','D-AK01'],['Kappsaege','Maschine','machine','D-KS01']];
  resourceSpecs.forEach(([name,type,equipment_kind,identifier],i)=>add('resources',{id:`DEMO-R${i+1}`,name,type:type==='Geraet'?'Gerät':type,resource_type_id:`00000000-0000-4000-8000-00000000000${i<2?1:i===2?3:i===3?5:4}`,equipment_kind,identifier,brand:'Demo',model:i<2?'Transporter':'Pro-Serie',serial_number:`DEMO-SN${i+1}`,build_year:'2024',status:'verfuegbar',availability:'available',responsible_person_id:`DEMO-MA${i%3+1}`,location:'Demo-Hauptlager',purchase_date:day(-200),purchase_price:i<2?220000:12500,warranty_until:day(365),operating_hours:i===2?124:null,logbook_active:i<2,current_odometer:i===0?45216:i===1?18000:null,current_odometer_date:day(-1),license_plate:i<2?identifier:null,default_driver_id:i<2?`DEMO-MA${i+1}`:null,logbook_year:today.slice(0,4),odometer_year_start:i===0?45000:i===1?18000:null,standard_trips:i===0?[{id:'DEMO-STD1',label:'Werkstatt - Ferienhaus',startAddress:'Demo-Werkstatt, Musterort',endAddress:'Demoweg 1, Musterort',purpose:'Kundeneinsatz',tripType:'Dienstfahrt',visited:'Familie Lindholm',distanceKm:18,waypoints:[]}]:[]}));
  [['DEMO-LOC1','Hauptlager','warehouse',null],['DEMO-LOC2','Servicewagen Nord','vehicle','DEMO-R1'],['DEMO-LOC3','Montagebus Sued','vehicle','DEMO-R2']].forEach(([id,name,location_kind,resource_id])=>add('inventory_locations',{id,name,site:'Demo-Werkstatt',location_kind,resource_id,location_code:id,note:'Fiktiver Lagerort'}));
  const supplier=fixtureUuid('supplier');
  add('suppliers',{id:supplier,supplier_number:'D-LF001',company:'Musterholz Grosshandel',email:'lieferant@example.invalid',address:'Demo-Gewerbepark 1, Musterort',payment_terms:'30 Tage',notes:'Fiktiver Lieferant; keine echten Bestellungen versenden.'});
  const materials=[['Terrassendiele 28x120','Meter',85,42],['Kantholz 45x95','Meter',45,22],['Montageschrauben','Packung',125,65],['Holzschutzlasur','Liter',240,135],['Arbeitsplatte Eiche','Stueck',2450,1300],['Winkelverbinder','Stueck',35,12],['Schleifpapier','Packung',95,35],['Reinigungsmittel','Liter',65,28]];
  materials.forEach(([name,unit,sales_price,purchase_price],i)=>add('materials',{id:`DEMO-MAT${i+1}`,sku:`D-M00${i+1}`,name,category:i===7?'Verbrauchsmaterial':'Baumaterial',unit:unit==='Stueck'?'Stück':unit,sales_price,purchase_price,currency:'SEK',tax_rate:25,min_stock:5,max_stock:200,reorder_quantity:25,primary_location_id:'DEMO-LOC1',preferred_supplier_id:supplier,supplier:'Musterholz Grosshandel',description:'Fiktives Demo-Material',accounting_account:'3058'}));
  add('stock_cutovers',{imported_entries:0});
  const jobs=[
    ['Terrasse erneuern',1,1,'in Arbeit',-3,3,1],['Kueche montieren',2,5,'geplant',2,5,1],['Wartung Eingangstuer',3,3,'geplant',1,1,2],['Gartenpflege Seeblick',4,4,'geplant',3,3,3],['Regale montieren',3,3,'erledigt',-7,-5,1],['Fenster einstellen',1,1,'erledigt',-10,-9,2],
  ];
  jobs.forEach(([title,obj,customer,status,start,end,service],i)=>add('jobs',{id:`DEMO-J${i+1}`,title,object_id:`DEMO-O${obj}`,customer_id:`DEMO-K${customer}`,type:'Einmalig',status,priority:i===0?'hoch':'normal',start_date:day(start),end_date:day(end),due_date:day(end),assigned_to:`DEMO-MA${i%3+1}`,description:'Fiktiver Vorfuehrauftrag: '+title,internal_notes:'Nur Demodaten - nicht an echte Kunden versenden.',billable:true,work_minutes:i===0?420:i>3?180:0,resource_ids:['DEMO-R1','DEMO-R4'],service_ids:[`DEMO-L${service}`],service_quantities:{[`DEMO-L${service}`]:i===0?'7':'3'},checklist:[{id:`DEMO-J${i+1}-T1`,title:'Material und Arbeitsbereich pruefen'},{id:`DEMO-J${i+1}-T2`,title:'Arbeiten ausfuehren'},{id:`DEMO-J${i+1}-T3`,title:'Ergebnis pruefen und dokumentieren'}]}));
  materials.forEach(([, , ,purchase_price],i)=>{
    add('stock_movements',{id:fixtureUuid(`receipt${i}`),material_id:`DEMO-MAT${i+1}`,destination_id:'DEMO-LOC1',quantity:i===4?5:100,unit_price:purchase_price,note:'Demo-Wareneingang',actor_user_id:actor,occurred_at:at(-12,8)});
    add('stock_movements',{id:fixtureUuid(`transfer${i}`),material_id:`DEMO-MAT${i+1}`,source_id:'DEMO-LOC1',destination_id:'DEMO-LOC2',quantity:i===4?2:20,note:'Material in Demo-Servicewagen verladen',actor_user_id:actor,occurred_at:at(-3,7)});
    if(i<4)add('stock_movements',{id:fixtureUuid(`use${i}`),material_id:`DEMO-MAT${i+1}`,source_id:'DEMO-LOC2',job_id:'DEMO-J1',quantity:[12,8,2,3][i],note:'Materialverbrauch Terrasse - Demo',actor_user_id:actor,occurred_at:at(-2,14)});
  });
  add('job_notes',{id:'DEMO-NOTIZ1',job_id:'DEMO-J1',work_date:day(-2),note:'Unterkonstruktion montiert. Terrassendielen teilweise verlegt. Abschluss bei naechstem Einsatz.'});
  add('field_progress',{id:'DEMO-FP1',job_id:'DEMO-J1',work_date:day(-2),task_id:'DEMO-L1-DEMO-TASK1',completed:true,minutes:420,note:'Unterkonstruktion fertiggestellt; erste Dielen verlegt.',show_work_time_in_report:true});
  for(let d=0;d<5;d++)for(let e=0;e<3;e++){
    const offset=-7+d;
    for(const [kind,start,end] of [['work',7,12],['pause',12,13],['work',13,16]])add('staff_time_entries',{id:fixtureUuid(`staff-${d}-${e}-${start}`),employee_id:`DEMO-MA${e+1}`,kind,started_at:at(offset,start),ended_at:at(offset,end),note:kind==='work'?'Demo-Arbeitstag: Montage und Werkstatt':'Mittagspause',created_by:actor,updated_by:actor});
  }
  staff.forEach((_,i)=>add('staff_leave_balances',{employee_id:`DEMO-MA${i+1}`,year:Number(today.slice(0,4)),entitlement_days:25,carryover_days:2,used_days:i===1?3:0,updated_by:actor}));
  for(const [i,status,offset,days]of [[1,'approved',10,3],[2,'requested',18,2]]){
    const id=fixtureUuid(`leave${i}`);
    add('staff_leave_requests',{id,employee_id:`DEMO-MA${i+1}`,from_date:day(offset),to_date:day(offset+days-1),days,note:'Fiktiver Urlaubsantrag',status,requested_by:actor,...(status==='approved'?{decided_at:at(-1,10),decided_by:actor,decision_reason:'Demo-Freigabe'}:{})});
    add('staff_leave_events',{id:fixtureUuid(`leave-event${i}`),request_id:id,action:'requested',actor_id:actor,reason:'Demo-Antrag'});
    if(status==='approved')add('staff_leave_events',{id:fixtureUuid(`leave-approval${i}`),request_id:id,action:'approved',actor_id:actor,reason:'Demo-Freigabe'});
  }
  let odo=45000;
  for(let i=0;i<12;i++){
    const kilometers=18;
    add('vehicle_trips',{id:`DEMO-TRIP${i+1}`,resource_id:'DEMO-R1',trip_date:day(-6+Math.floor(i/2)),driver_id:'DEMO-MA1',status:'abgeschlossen',started_at:at(-6+Math.floor(i/2),i%2?16:7),ended_at:at(-6+Math.floor(i/2),i%2?17:8),trip_type:'Dienstfahrt',start_address:i%2?'Demoweg 1, Musterort':'Demo-Werkstatt, Musterort',end_address:i%2?'Demo-Werkstatt, Musterort':'Demoweg 1, Musterort',start_odometer:odo,end_odometer:odo+kilometers,kilometers,purpose:i%2?'Rueckfahrt Werkstatt':'Kundeneinsatz Terrasse',visited:'Familie Lindholm',notes:'Fiktive Demo-Fahrt'});odo+=kilometers;
  }
  for(let i=0;i<3;i++)add('reports',{id:`DEMO-BER${i+1}`,job_id:['DEMO-J1','DEMO-J5','DEMO-J6'][i],object_id:i===1?'DEMO-O3':'DEMO-O1',customer_id:i===1?'DEMO-K3':'DEMO-K1',title:['Terrassenbau - Zwischenbericht','Regalmontage - Abschlussbericht','Fensterwartung - Abschlussbericht'][i],report_date:day(-2-i*3),summary:['Unterkonstruktion montiert und erste Dielen verlegt. Materialverbrauch und Arbeitszeit dokumentiert.','Wandregale sicher montiert. Arbeitsbereich gereinigt.','Beschlaege justiert und Dichtungen geprueft.'][i],visible_to_customer:true,internal_notes:'Fiktiver Demo-Bericht',checklist_results:[{id:'DEMO-REPORT-TASK',title:'Arbeitsergebnis geprueft',completed:true,minutes:180,note:'Fiktiver Nachweis',photos:[]}],media_ids:i===0?['DEMO-IMG-REPORT']:[]});
  [0,1].forEach(i=>add('billing_items',{id:`DEMO-RE${i+1}`,object_id:i?'DEMO-O1':'DEMO-O3',customer_id:i?'DEMO-K1':'DEMO-K3',job_id:i?'DEMO-J6':'DEMO-J5',report_id:i?'DEMO-BER3':'DEMO-BER2',source:'Auftrag',label:i?'Fensterwartung':'Regalmontage',amount:i?2325:2568.75,net_total:i?1860:2055,tax_total:i?465:513.75,gross_total:i?2325:2568.75,currency:'SEK',status:i?'abgerechnet':'abrechenbar',invoice_status:i?'bezahlt':'Entwurf',invoice_number:i?'DEMO-RE-2026-001':null,invoice_date:i?day(-8):null,due_date:i?day(6):null,service_date:day(-9+i*4),paid_at:i?at(-2,12):null,notes:'DEMO - keine echte Rechnung',lines:[{id:`DEMO-LINE${i}`,label:i?'Montage und Reparatur':'Tischlerarbeiten',name:i?'Montage und Reparatur':'Tischlerarbeiten',quantity:'3',unit:'Stunde',price:i?'620':'685',taxRate:'25',currency:'SEK',accountingAccount:'3051'}]}));
  const order=fixtureUuid('order');
  add('purchase_orders',{id:order,order_number:'DEMO-BEST-001',supplier_id:supplier,status:'draft',order_date:today,expected_delivery:day(5),location_id:'DEMO-LOC1',currency:'SEK',notes:'Demo-Bestellung; nicht versenden.'});
  add('purchase_order_items',{id:fixtureUuid('order-item'),order_id:order,material_id:'DEMO-MAT1',quantity:40,unit_price:42});
  add('maintenance_plans',{id:fixtureUuid('maintenance'),resource_id:'DEMO-R3',name:'Jahresservice Rasenmaeher',maintenance_type:'Wartung',due_date:day(14),due_hours:150,interval_days:365,responsible_person_id:'DEMO-MA3',supplier_id:supplier,notes:'Oel, Filter und Messer pruefen'});
  for(const [id,owner_type,owner_id,file] of [['DEMO-IMG1','object','DEMO-O1','ferienhaus.jpg'],['DEMO-IMG2','object','DEMO-O2','kueche.jpg'],['DEMO-IMG3','resource','DEMO-R1','servicewagen.jpg'],['DEMO-IMG-REPORT','report','DEMO-BER1','ferienhaus.jpg']])add('media',{id,owner_type,owner_id,kind:owner_type==='report'?'attachment':'image',name:file,description:'KI-generiertes fiktives Demo-Bild',source:'Demo',storage_path:`${tenant}/demo-handwerk/${file}`,is_primary:true,customer_visible:true,metadata:{contentType:'image/jpeg'}});
  add('jobs',{id:'DEMO-J7',title:'Laufende Objektbetreuung Seeblick',object_id:'DEMO-O4',customer_id:'DEMO-K4',type:'laufend',status:'in Arbeit',priority:'normal',start_date:day(-20),assigned_to:'DEMO-MA3',billable:true,description:'Laufender Demo-Service mit einzeln abrechenbaren Zeitnachweisen.',consulting:{enabled:true,openEnded:true,hourlyRate:'520',currency:'SEK',invoiceText:'Objektbetreuung nach Aufwand'},schedule:{type:'einmalig',frequency:'wöchentlich',interval:1,weekdays:[],end:'nie',endDate:'',occurrences:0}});
  for(let i=0;i<4;i++)add('job_time_entries',{id:`DEMO-ZEIT${i+1}`,job_id:'DEMO-J7',entry_date:day(-8+i*2),start_time:'09:00',end_time:'11:00',minutes:120,description:['Aussenanlagen kontrolliert','Gartenpflege und Reinigung','Kleine Reparaturen','Objektkontrolle und Dokumentation'][i],billing_status:'offen'});
  // Keep compatibility structures in the exact shapes consumed by the app.
  for(const {table,row} of rows){
    if(table==='homecare_jobs'){
      row.checklist=(row.checklist??[]).map(item=>typeof item==='string'?item:item.title);
      row.schedule??={type:'einmalig',frequency:'wöchentlich',interval:1,weekdays:[],end:'nie',endDate:'',occurrences:0};
      const assigned=staff[Number(row.assigned_to.replace('DEMO-MA',''))-1];
      row.assigned_to=`${assigned[0]} ${assigned[1]}`;
    }
    if(table==='homecare_services')row.checklist=row.checklist.map(item=>({...item,note:'Ergebnis dokumentieren',defaultMinutes:60}));
    if(table==='homecare_billing_items'){
      row.invoice_status=row.invoice_status.toLowerCase();
      row.lines=row.lines.map(({price,...line})=>({...line,kind:'Leistung',unitPrice:price}));
    }
    if(table==='homecare_media'){
      if(row.owner_type!=='report')row.kind='Bild';
      else {row.kind='checklist_photo';row.metadata={...row.metadata,taskId:'DEMO-REPORT-TASK',accepted:true};}
    }
    if(table==='homecare_reports')row.checklist_results=row.checklist_results.map(task=>({...task,meta:'Demo-Handwerksleistung',description:'Arbeitsergebnis und Zeit dokumentiert.',showWorkTimeInReport:true}));
    if(table==='homecare_accounting_accounts')row.category=row.account==='3051'?'Leistung':row.account==='3058'?'Material':'Sonstiges';
  }
  return rows;
}

export const quote = value => `'${String(value).replaceAll("'", "''")}'`;
export function insertSql({table,row}) {
  if(!/^homecare_[a-z_]+$/.test(table)||!Object.keys(row).every(key=>/^[a-z_]+$/.test(key)))throw new Error('Invalid SQL identifier');
  const columns=Object.keys(row).map(key=>`"${key}"`).join(',');
  return `insert into public.${table}(${columns}) select ${columns} from jsonb_populate_record(null::public.${table},${quote(JSON.stringify(row))}::jsonb);`;
}
