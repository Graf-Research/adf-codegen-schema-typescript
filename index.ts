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

  function buildSchemaDependency(schema: Schema.Schema, list_schema: Schema.Schema[], map_ts_model_path: TypescriptModel.MapTSModelFilePath): string[] {
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
          ...buildSchemaDependency(schema, list_schema, map_ts_model_path),
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
      `import { ClassConstructor, Transform, Type, plainToInstance } from "class-transformer";`,
      `import { IsNotEmpty, IsNumber, IsObject, IsBoolean, IsOptional, IsISO8601, IsString, IsEnum, ValidateNested, IsArray, ValidationError, validateOrReject } from "class-validator";\n`,
      `export class ${schema.name} {`,
      ...schema.items
        .reduce((acc: string[], c: Schema.Item) => [...acc, ...buildField(c)], [])
        .map(line => '  ' + line),
      `}`
    ];
  }

  const transform_integer = `(param?: any): number | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : parseInt(param.value)`;
  const transform_arrayinteger = `(param?: any): (number | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : parseInt(value))`;

  const transform_decimal = `(param?: any): number | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : parseFloat(param.value)`;
  const transform_arraydecimal = `(param?: any): (number | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : parseFloat(value))`;

  const transform_boolean = `(param?: any): boolean | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : (param?.value === 'true' || ((typeof param?.value === 'boolean') && param?.value))`;
  const transform_arrayboolean = `(param?: any): (boolean | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : (value === 'true' || ((typeof value === 'boolean') && value)))`;

  const transform_date = `(param?: any): Date | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : new Date(param?.value)`;
  const transform_arraydate = `(param?: any): (Date | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : new Date(value))`;

  export function getDecorators(item: Schema.Item): string[] {
    const list_decorator: string[] = [];
    
    if (item.required) {
      list_decorator.push(`@IsNotEmpty({ message: '${item.key} cannot be empty' })`);
    } else {
      list_decorator.push(`@IsOptional()`);
    }
  
    if (item.type.type === 'native') {
      const array_property = item.array ? ', each: true' : '';
      switch (item.type.native_type) {
        case 'number':
          list_decorator.push(`@Transform(${item.array ? transform_arraydecimal : transform_decimal})`);
          list_decorator.push(`@IsNumber({}, { message: '${item.key} must be a number (decimal)'${array_property} })`);
          break;
        case 'boolean':
          list_decorator.push(`@Transform(${item.array ? transform_arrayboolean : transform_boolean})`);
          list_decorator.push(`@IsBoolean({ message: '${item.key} must be a boolean'${array_property} })`);
          break;
        case 'string':
          list_decorator.push(`@IsString({ message: '${item.key} must be a string'${array_property} })`);
          break;
      }
    }
  
    if (item.type.type === 'enum') {
      const array_property = item.array ? ', each: true' : '';
      list_decorator.push(`@IsEnum(${item.type.enum_name}, { message: '${item.key} must be enum ${item.type.enum_name}'${array_property} })`);
    }
  
    if (item.type.type === 'schema') {
      if (item.array) {
        list_decorator.push(`@IsArray()`);
        list_decorator.push(`@ValidateNested({ each: true })`);
      } else {
        list_decorator.push(`@IsObject()`);
        list_decorator.push(`@ValidateNested()`);
      }
      list_decorator.push(`@Type(() => ${item.type.schema_name})`);
    }
  
    if (item.type.type === 'table') {
      if (item.array) {
        list_decorator.push(`@IsArray()`);
        list_decorator.push(`@ValidateNested({ each: true })`);
      } else {
        list_decorator.push(`@IsObject()`);
        list_decorator.push(`@ValidateNested()`);
      }
      list_decorator.push(`@Type(() => ${item.type.table_name})`);
    }
  
    return list_decorator;
  }

  function buildField(item: Schema.Item): string[] {
    switch (item.type.type) {
      case "native":
        return [
          ...getDecorators(item),
          `${item.key}${item.required ? '!' : '?'}: ${item.type.native_type}${item.array ? '[]' : ''}`
        ];
      case "schema":
        return [
          ...getDecorators(item),
          `${item.key}${item.required ? '!' : '?'}: ${item.type.schema_name}${item.array ? '[]' : ''}`
        ];
      case "table":
        return [
          ...getDecorators(item),
          `${item.key}${item.required ? '!' : '?'}: ${item.type.table_name}${item.array ? '[]' : ''}`
        ];
      case "enum":
        return [
          ...getDecorators(item),
          `${item.key}${item.required ? '!' : '?'}: ${item.type.enum_name}${item.array ? '[]' : ''}`
        ];
    }
  }
}
