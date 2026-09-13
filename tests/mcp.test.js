import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {fileURLToPath} from 'node:url';
test('real MCP stdio handshake and capabilities',async()=>{
 const client=new Client({name:'test',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server/mcp.js',import.meta.url))]});
 try{
 await client.connect(transport);
 const listed=await client.listTools();assert.ok(['read_draft','prepare_ad','upload_media','commit_ad'].every(name=>listed.tools.some(t=>t.name===name)));
 const result=await client.callTool({name:'capabilities',arguments:{}});
 assert.equal(JSON.parse(result.content[0].text).publishingEnabled,true);
 }finally{await client.close();}
});
