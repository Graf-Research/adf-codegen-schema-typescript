import _ from "lodash";
import { Schema } from "@graf-research/adf-core";
import { TypescriptModel } from "@graf-research/adf-codegen-model-typescript";

export namespace TypescriptSchema {
  export type MapTSSchemaFilePath = {[key: string]: string};
  export interface CodegenFileOutput {
    filename: string
    content: string
  }
  
  export interface Output {
    files: CodegenFileOutput[]
    map: MapTSSchemaFilePath
  }

  export function compile(list_schema: Schema.Schema[], map_ts_model_path: TypescriptModel.MapTSModelFilePath): Output {
    const list_schema_output: Output[] = list_schema.map((s: Schema.Schema) => buildFromSchema(s, list_schema, map_ts_model_path));

    return {
      files: list_schema_output.reduce((accumulator: CodegenFileOutput[], o: Output) => [...accumulator, ...o.files], []),
      map: list_schema_output.reduce((accumulator: MapTSSchemaFilePath, o: Output) => ({ ...accumulator, ...o.map }), {})
    };
  }

  function getSchemaFileName(schema: Schema.Schema, extension?: string): string {
    return `./ts-schema/${schema.name}${extension ?? ''}`;
  }

  function buildTableDependency(schema: Schema.Schema, list_schema: Schema.Schema[], map_ts_model_path: TypescriptModel.MapTSModelFilePath): string[] {
    return schema.items
      .filter((item: Schema.Item) => item.type.type === 'schema' || item.type.type === 'table')
      .map((item: Schema.Item) => {
        switch (item.type.type) {
          case 'schema': 
            const schema_item = list_schema.find((s: Schema.Schema) => item.type.type === 'schema' && s.name === item.type.schema_name);
            if (!schema_item) {
              throw new Error(`Schema "${item.type.schema_name}" is not available`);
            }
            return `import { ${schema_item.name} } from '.${getSchemaFileName(schema_item)}'`;
          case 'table':
            const table_path = map_ts_model_path[item.type.table_name];
            if (!table_path) {
              throw new Error(`Table "${item.type.table_name}" is not available on models`);
            }
            return `import { ${item.type.table_name} } from '.${table_path}'`;
          default:
            return '';
        }
      });
  }

  function buildFromSchema(schema: Schema.Schema, list_schema: Schema.Schema[], map_ts_model_path: TypescriptModel.MapTSModelFilePath): Output {
    return {
      files: [{
        filename: getSchemaFileName(schema, '.ts'),
        content: [
          ...buildTableDependency(schema, list_schema, map_ts_model_path),
          '',
          ...getSchemaContent(schema),
        ].join('\n')
      }],
      map: {
        [schema.name]: getSchemaFileName(schema)
      }
    }
  }

  export function getSchemaContent(schema: Schema.Schema): string[] {
    return [
      `export interface ${schema.name} {`,
      ...schema.items
        .reduce((acc: string[], c: Schema.Item) => [...acc, ...buildField(c)], [])
        .map(line => '  ' + line),
      `}`
    ];
  }

  function buildField(item: Schema.Item): string[] {
    switch (item.type.type) {
      case "native":
        return [
          `${item.key}${item.required ? '' : '?'}: ${item.type.native_type}${item.array ? '[]' : ''}`
        ];
      case "schema":
        return [
          `${item.key}${item.required ? '' : '?'}: ${item.type.schema_name}${item.array ? '[]' : ''}`
        ];
      case "table":
        return [
          `${item.key}${item.required ? '' : '?'}: ${item.type.table_name}${item.array ? '[]' : ''}`
        ];
      case "enum":
        return [
          `${item.key}${item.required ? '' : '?'}: ${item.type.enum_name}${item.array ? '[]' : ''}`
        ];
    }
  }
}
