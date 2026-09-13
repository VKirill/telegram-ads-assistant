import {operations} from '../src/operations.js';
import {resolveMediaSource} from './media.js';
import {browserCall} from './bridge-client.js';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {Service} from './service.js';
import {fileURLToPath} from 'node:url';
const service=new Service(process.env.TG_ASSISTANT_DATA_DIR||fileURLToPath(new URL('../.local/mcp/',import.meta.url)));
const server=new McpServer({name:'telegram-ads-assistant',version:'0.1.0'});
const definitions={
 read_constraints:{description:'Прочитать актуальные числовые ограничения текущего кабинета без сохранения рекламы',inputSchema:{}},
 read_draft:{description:'Прочитать текущий черновик и свежий fingerprint без изменения полей',inputSchema:{}},
 prepare_schedule:{description:'Подготовить недельную сетку часов, в порядке строк кабинета; не сохранить объявление',inputSchema:{adId:z.string().regex(/^\d+$/),hours:z.array(z.array(z.number().int().min(0).max(23))).length(7),timezoneSeconds:z.number().int()}},

 clone_ad:{description:'Открыть штатный черновик копии объявления без создания',inputSchema:{adId:z.string().regex(/^\d+$/)}},
 read_ad:{description:'Прочитать настройки объявления',inputSchema:{adId:z.string().regex(/^\d+$/)}},
 read_budget:{description:'Текущий бюджет и история операций',inputSchema:{adId:z.string().regex(/^\d+$/)}},
 export_csv:{description:'Скачать CSV из реальной ссылки отчёта, без выдачи служебного URL',inputSchema:{adId:z.string().regex(/^\d+$/),month:z.string().regex(/^20[0-9]{2}(0[1-9]|1[0-2])$/).optional()}},
 read_statistics:{description:'Прочитать отображаемые данные страницы Statistics; графики не извлекаются',inputSchema:{adId:z.string().regex(/^\d+$/),month:z.string().regex(/^20[0-9]{2}(0[1-9]|1[0-2])$/).optional()}},
 prepare_ad:{description:'Заполнить новый черновик Search/Bots/Users/Channels без создания',inputSchema:{ad:z.unknown()}},
 upload_media:{description:'Загрузить MP4/JPEG/PNG по path либо url (HTTP(S), включая localhost) в текущий черновик без публикации',inputSchema:{path:z.string().optional(),url:z.string().url().optional(),adId:z.string().regex(/^\d+$/).optional()}},
 prepare_edit:{description:'Подготовить CPM, статус, текст и другие изменяемые поля без сохранения',inputSchema:{adId:z.string().regex(/^\d+$/),patch:z.record(z.string(),z.unknown())}},
 prepare_budget:{description:'Подготовить добавление или возврат бюджета без перевода средств',inputSchema:{adId:z.string().regex(/^\d+$/),direction:z.enum(['add','withdraw']),amount:z.number().positive()}},
 commit_ad:{description:'Сохранить подготовленное объявление по fingerprint и уникальному operationId; затем проверить запись.',inputSchema:{operationId:z.string(),expectedFingerprint:z.string()}},
 commit_edit:{description:'Сохранить подготовленные изменения; затем проверить запись.',inputSchema:{adId:z.string(),operationId:z.string(),expectedFingerprint:z.string()}},
 commit_budget:{description:'Применить подготовленную бюджетную операцию; затем проверить транзакцию.',inputSchema:{adId:z.string(),operationId:z.string(),expectedFingerprint:z.string(),direction:z.enum(['add','withdraw'])}},
 delete_ad:{description:'Открыть штатное подтверждение удаления.',inputSchema:{adId:z.string(),operationId:z.string(),expectedFingerprint:z.string()}},

 reload_extension:{description:'Перезагрузить локальное распакованное расширение. Ответ requested не означает завершение; проверить extension_status и reloadReceipt.',inputSchema:{}},
 extension_status:{description:'Связь, версия и квитанция повторного запуска расширения',inputSchema:{}},
 read_account:{description:'Свежий снимок загруженных строк кабинета, без фильтра дат. Не отчёт за период.',inputSchema:{}},
 inspect_form:{description:'Прочитать структуру формы нового объявления',inputSchema:{}},
 prepare_form:{description:'Заполнить черновик без создания/публикации. Одна попытка; повтор после ошибки запрещён до сверки.',inputSchema:{package:z.unknown(),adId:z.string()}},
 capabilities:{description:'Возможности и ограничения локального приложения',inputSchema:{}},
 validate_package:{description:'Проверить JSON рекламы без записи в кабинет',inputSchema:{package:z.unknown()}},
 stage_package:{description:'Сохранить пакет только локально. Не создаёт рекламу.',inputSchema:{package:z.unknown()}},
 list_packages:{description:'Локальные пакеты, не список рекламного кабинета',inputSchema:{}},
 get_package:{description:'Получить локальный пакет для импорта в расширение',inputSchema:{id:z.string()}},
 get_statistics:{description:'Статистика: пока возвращает явную недоступность, браузерный мост не подключён',inputSchema:{accountId:z.string(),from:z.string().date(),to:z.string().date()}}
};
for(const [name,config] of Object.entries(definitions))server.registerTool(name,config,async args=>{
 try{if(name==='upload_media'){const {asset}=await resolveMediaSource(args);args={adId:args.adId,asset};}
 const result=await (operations[name]||['read_account','inspect_form','prepare_form','reload_extension','extension_status'].includes(name)?browserCall(name,args):service.call(name,args));
 return {isError:result==null||!!result.error,content:[{type:'text',text:JSON.stringify(result??{error:'missing_result'})}]};}
 catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
});
await server.connect(new StdioServerTransport());
