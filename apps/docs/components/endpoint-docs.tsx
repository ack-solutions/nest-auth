import styles from './endpoint-docs.module.css';
import openapi from '@/public/api/nest-auth.json';

type Json = Record<string, any>;
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Props {
  method: Method;
  path: string;
}

export function EndpointDocs({ method, path }: Props) {
  const spec = openapi as Json;
  const operation = spec.paths?.[path]?.[method];

  if (!operation) {
    return <p className={styles.error}>Operation <code>{method.toUpperCase()} {path}</code> not found in the OpenAPI spec.</p>;
  }

  const requestBody = operation.requestBody;
  const responses = operation.responses ?? {};
  const params = operation.parameters ?? [];

  const pathParams = params.filter((p: Json) => p.in === 'path');
  const queryParams = params.filter((p: Json) => p.in === 'query');
  const headerParams = params.filter((p: Json) => p.in === 'header');

  return (
    <div className={styles.endpoint}>
      <header className={styles.head}>
        <span className={`${styles.method} ${styles[`m_${method}`]}`}>{method.toUpperCase()}</span>
        <code className={styles.pathStr}>{path}</code>
      </header>

      {operation.description && (
        <p className={styles.description}>{operation.description}</p>
      )}

      {pathParams.length > 0 && (
        <Section title="Path parameters">
          <ParamTable params={pathParams} spec={spec} />
        </Section>
      )}

      {queryParams.length > 0 && (
        <Section title="Query parameters">
          <ParamTable params={queryParams} spec={spec} />
        </Section>
      )}

      {headerParams.length > 0 && (
        <Section title="Headers">
          <ParamTable params={headerParams} spec={spec} />
        </Section>
      )}

      {requestBody?.content?.['application/json']?.schema && (
        <Section title="Request body">
          <SchemaView schema={requestBody.content['application/json'].schema} spec={spec} />
          <RequestExamples
            schema={requestBody.content['application/json'].schema}
            spec={spec}
          />
        </Section>
      )}

      <Section title="Responses">
        <div className={styles.responsesList}>
          {Object.entries(responses).map(([code, raw]) => {
            const r = raw as Json;
            const schema = r.content?.['application/json']?.schema;
            return (
              <div key={code} className={styles.responseBlock}>
                <div className={styles.responseHead}>
                  <span className={`${styles.statusBadge} ${styles[statusClass(code)]}`}>{code}</span>
                  <span className={styles.responseDesc}>{r.description ?? ''}</span>
                </div>
                {schema && <SchemaView schema={schema} spec={spec} />}
                {schema && <ResponseExample schema={schema} spec={spec} />}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Try it">
        <CurlExample method={method} path={path} requestBody={requestBody} spec={spec} />
      </Section>
    </div>
  );
}

/* ---------- helpers ---------- */

function statusClass(code: string) {
  if (code.startsWith('2')) return 's_2xx';
  if (code.startsWith('4')) return 's_4xx';
  if (code.startsWith('5')) return 's_5xx';
  return 's_other';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function deref(node: Json | undefined, spec: Json, depth = 0): Json {
  if (!node || depth > 8) return node ?? {};
  if (node.$ref) {
    const refKey = node.$ref.replace('#/components/schemas/', '');
    const target = spec.components?.schemas?.[refKey];
    if (target) return { ...deref(target, spec, depth + 1), __refName: refKey };
    return { __unresolvedRef: node.$ref };
  }
  return node;
}

function ParamTable({ params, spec }: { params: Json[]; spec: Json }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => {
            const schema = deref(p.schema, spec);
            return (
              <tr key={p.name}>
                <td><code className={styles.fieldName}>{p.name}</code></td>
                <td><code className={styles.fieldType}>{describeType(schema)}</code></td>
                <td>{p.required ? <span className={styles.req}>required</span> : <span className={styles.opt}>optional</span>}</td>
                <td className={styles.fieldDesc}>{p.description ?? schema.description ?? ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SchemaView({ schema, spec, title }: { schema: Json; spec: Json; title?: string }) {
  const resolved = deref(schema, spec);
  if (resolved.oneOf || resolved.anyOf) {
    const variants: Json[] = resolved.oneOf ?? resolved.anyOf ?? [];
    return (
      <div>
        {title && <p className={styles.subtitle}>{title}</p>}
        <p className={styles.subtitle}>One of:</p>
        <div className={styles.oneOfList}>
          {variants.map((v, i) => {
            const r = deref(v, spec);
            return (
              <div key={i} className={styles.oneOfItem}>
                <div className={styles.oneOfHead}>
                  {r.__refName ? <code className={styles.fieldType}>{r.__refName}</code> : <span className={styles.fieldDesc}>variant {i + 1}</span>}
                </div>
                <PropTable schema={r} spec={spec} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (resolved.type === 'array' && resolved.items) {
    const item = deref(resolved.items, spec);
    return (
      <div>
        <p className={styles.subtitle}>
          Array of <code className={styles.fieldType}>{item.__refName ?? describeType(item)}</code>
        </p>
        <PropTable schema={item} spec={spec} />
      </div>
    );
  }

  return (
    <div>
      {resolved.__refName && (
        <p className={styles.subtitle}><code className={styles.fieldType}>{resolved.__refName}</code></p>
      )}
      <PropTable schema={resolved} spec={spec} />
    </div>
  );
}

function PropTable({ schema, spec }: { schema: Json; spec: Json }) {
  const props = schema.properties ?? {};
  const required: string[] = schema.required ?? [];
  const entries = Object.entries(props);

  if (entries.length === 0) {
    if (schema.type) {
      return <p className={styles.fieldDesc}>Type: <code className={styles.fieldType}>{describeType(schema)}</code></p>;
    }
    return <p className={styles.fieldDesc}>No properties.</p>;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, raw]) => {
            const v = deref(raw as Json, spec);
            return (
              <tr key={key}>
                <td><code className={styles.fieldName}>{key}</code></td>
                <td><code className={styles.fieldType}>{describeType(v)}</code></td>
                <td>{required.includes(key) ? <span className={styles.req}>required</span> : <span className={styles.opt}>optional</span>}</td>
                <td className={styles.fieldDesc}>
                  {v.description ?? ''}
                  {v.enum && (
                    <div className={styles.enums}>
                      {v.enum.map((e: string) => (
                        <code key={String(e)} className={styles.enumPill}>{String(e)}</code>
                      ))}
                    </div>
                  )}
                  {v.default !== undefined && (
                    <div className={styles.muted}>Default: <code className={styles.fieldType}>{JSON.stringify(v.default)}</code></div>
                  )}
                  {v.example !== undefined && (
                    <div className={styles.muted}>Example: <code className={styles.fieldType}>{shortJson(v.example)}</code></div>
                  )}
                  {v.deprecated && <div className={styles.dep}>deprecated</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function describeType(s: Json | undefined): string {
  if (!s) return 'any';
  if (s.__refName) return s.__refName;
  if (s.oneOf) return s.oneOf.map((v: Json) => describeType(v)).join(' | ');
  if (s.anyOf) return s.anyOf.map((v: Json) => describeType(v)).join(' | ');
  if (s.type === 'array') return `${describeType(s.items)}[]`;
  if (s.enum) return s.enum.map((e: string) => JSON.stringify(e)).join(' | ');
  if (s.type === 'string' && s.format) return `string<${s.format}>`;
  return s.type ?? 'object';
}

function shortJson(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}

function RequestExamples({ schema, spec }: { schema: Json; spec: Json }) {
  const resolved = deref(schema, spec);
  const credProp = resolved.properties?.credentials;
  const examples: Array<{ key: string; summary: string; value: any }> = [];

  // Hoist credential examples up if present
  if (credProp?.examples) {
    for (const [k, ex] of Object.entries<any>(credProp.examples)) {
      examples.push({ key: k, summary: ex.summary ?? k, value: ex.value });
    }
  }

  if (examples.length === 0) {
    const sample = sampleFromSchema(resolved, spec);
    if (!sample) return null;
    examples.push({ key: 'default', summary: 'Example', value: sample });
  }

  return (
    <div className={styles.examplesWrap}>
      <p className={styles.subtitle}>Examples</p>
      <div className={styles.examplesList}>
        {examples.map((ex) => (
          <div key={ex.key} className={styles.exampleBlock}>
            <div className={styles.exampleHead}>{ex.summary}</div>
            <pre className={styles.codeBlock}><code>{JSON.stringify(ex.value, null, 2)}</code></pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponseExample({ schema, spec }: { schema: Json; spec: Json }) {
  const sample = sampleFromSchema(deref(schema, spec), spec);
  if (!sample) return null;
  return (
    <div className={styles.examplesWrap}>
      <p className={styles.subtitle}>Example response</p>
      <pre className={styles.codeBlock}><code>{JSON.stringify(sample, null, 2)}</code></pre>
    </div>
  );
}

function sampleFromSchema(schema: Json | undefined, spec: Json, depth = 0): any {
  if (!schema || depth > 6) return undefined;
  const s = deref(schema, spec, depth);
  if (s.example !== undefined) return s.example;

  if (s.type === 'array' && s.items) return [sampleFromSchema(s.items, spec, depth + 1)].filter((v) => v !== undefined);

  if (s.type === 'object' || s.properties) {
    const out: Json = {};
    const props: Json = s.properties ?? {};
    for (const [k, v] of Object.entries<Json>(props)) {
      const sample = sampleFromSchema(v, spec, depth + 1);
      if (sample !== undefined) out[k] = sample;
    }
    return Object.keys(out).length ? out : undefined;
  }

  if (s.oneOf && s.oneOf.length > 0) return sampleFromSchema(s.oneOf[0], spec, depth + 1);
  if (s.anyOf && s.anyOf.length > 0) return sampleFromSchema(s.anyOf[0], spec, depth + 1);

  if (s.enum) return s.enum[0];
  if (s.type === 'string') return 'string';
  if (s.type === 'number' || s.type === 'integer') return 0;
  if (s.type === 'boolean') return false;

  return undefined;
}

function CurlExample({
  method, path, requestBody, spec,
}: {
  method: string;
  path: string;
  requestBody: Json;
  spec: Json;
}) {
  const url = `https://api.example.com${path}`;
  const sample = requestBody?.content?.['application/json']?.schema
    ? sampleFromSchema(requestBody.content['application/json'].schema, spec)
    : undefined;

  const lines: string[] = [];
  lines.push(`curl -X ${method.toUpperCase()} '${url}' \\`);
  lines.push(`  -H 'Content-Type: application/json' \\`);
  lines.push(`  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'`);
  if (sample) {
    lines[lines.length - 1] += ` \\`;
    lines.push(`  -d '${JSON.stringify(sample)}'`);
  }

  return (
    <pre className={styles.codeBlock}><code>{lines.join('\n')}</code></pre>
  );
}
