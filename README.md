# Typescript Schema - ADF Code Generator

Generator kode [ADF](https://github.com/Graf-Research/adf-core) untuk Schema Typescript beserta Model Typescript.

**Modul ADF yang digunakan**

`Table` `Enum` `Schema`

**Penggunaan CLI (Command Line)**

```bash
npx @graf-research/adf-codegen-schema-typescript <file/url ADF> <folder output>
```

## Instalasi

```bash
npm install --save @graf-research/adf-codegen-schema-typescript
```

## Fungsi

```typescript
import { Model, Schema } from "@graf-research/adf-core";
import { TypescriptModel } from "@graf-research/adf-codegen-model-typescript";

export type MapTSSchemaFilePath = {[key: string]: string};

export interface CodegenFileOutput {
  filename: string
  content: string
}

export interface Output {
  files: CodegenFileOutput[]
  map: MapTSSchemaFilePath
}

function TypescriptSchema.compile(list_schema: Schema.Schema[], map_ts_model_path: TypescriptModel.MapTSModelFilePath): Output
```

Generator kode ini akan menghasilkan file dengan struktur folder sebagai berikut:

```
<folder output> --+-- ts-schema --+-- Schema1.ts
                  |               |   
                  |               +-- ...
                  |
                  +-- ts-model --+-- table --+-- Model1.ts
                                 |           |   
                                 |           +-- ...
                                 |
                                 +-- enum --+-- Enum1.ts
                                            |
                                            +-- ...
```

### Contoh Terjemahan Kode

data.adf
```
table User {
  id bigint pk inc notnull
  fullname varchar(255) notnull
  username varchar(255)
  email varchar(255)
  phone_number varchar(255)
  password varchar(255) notnull
  created_at timestamp notnull
}

schema UserAuthResponse {
  token string required
  data table.User required
}
```

terjemahan ts-schema
```typescript
import { User } from '../ts-model/table/User'

export interface UserAuthResponse {
  token: string
  data: User
}
```
