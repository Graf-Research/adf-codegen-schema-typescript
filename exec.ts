#!/usr/bin/env node
import fs from 'fs';
import { parse, SAResult } from '@graf-research/adf-core';
import axios from 'axios';
import { TypescriptSchema } from '.';
import { TypescriptModel } from '@graf-research/adf-codegen-model-typescript';

const url_regex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

if (!process.argv[2]) {
  throw new Error(`argv[2] cannot be empty`);
}

if (!process.argv[3]) {
  throw new Error(`argv[3] cannot be empty`);
}

exec(process.argv[2], process.argv[3]);

async function exec(input_file_or_url: string, out_folder: string) {
  const result: SAResult = await parse(input_file_or_url);
  const ts_model = TypescriptModel.compile([...result.list_table, ...result.list_enum]);
  const ts_schema = TypescriptSchema.compile(result.list_schema, { ...ts_model.enum.map, ...ts_model.table.map });

  for (const f of ts_model.enum.files) {
    writeFiles(f, out_folder);
  }
  for (const f of ts_model.table.files) {
    writeFiles(f, out_folder);
  }
  for (const f of ts_schema.files) {
    writeFiles(f, out_folder);
  }
}

async function writeFiles(output: TypescriptModel.CodegenFileOutput, main_project_location: string = 'project') {
  const folder = main_project_location + '/' + output.filename.split('/').slice(0, -1).join('/');
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const filename = main_project_location + '/' + output.filename;
  fs.writeFileSync(filename, output.content);
}
