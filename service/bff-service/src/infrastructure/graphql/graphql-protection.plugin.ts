import { Injectable, Logger } from '@nestjs/common';
import { Plugin } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import {
  GraphQLError,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
  Kind,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLField,
  isListType,
  isNonNullType,
  GraphQLOutputType,
} from 'graphql';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphQLProtectionConfig {
  /**
   * Maximum allowed query depth.
   * Rule of thumb: typical REST-to-GraphQL migrations rarely legitimately
   * exceed depth 7–8.  Default: 10.
   *
   * Example: query { user { tasks { comments { author { profile { … } } } } } }
   *                          1       2          3          4         5  → depth 5
   */
  maxDepth?: number;

  /**
   * Maximum allowed query complexity score.
   * Each scalar field costs 1, each list field costs `listMultiplier`.
   * Default: 200.
   */
  maxComplexity?: number;

  /**
   * Cost multiplier applied to fields that return a list type.
   * Higher multiplier = stricter protection on lists.
   * Default: 10.
   */
  listMultiplier?: number;

  /**
   * Maximum number of tokens (fields + directives + arguments) in a query.
   * Protects against extremely long but shallow queries.
   * Default: 1000.
   */
  maxTokens?: number;
}

const DEFAULTS: Required<GraphQLProtectionConfig> = {
  maxDepth: 10,
  maxComplexity: 200,
  listMultiplier: 10,
  maxTokens: 1000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Depth Analysis
// ─────────────────────────────────────────────────────────────────────────────

function calculateDepth(
  node: SelectionSetNode | FieldNode | InlineFragmentNode | FragmentSpreadNode,
  fragments: Record<string, FragmentDefinitionNode>,
  depth: number,
): number {
  if (node.kind === Kind.SELECTION_SET) {
    return Math.max(
      ...node.selections.map((s) => calculateDepth(s as any, fragments, depth)),
      0,
    );
  }

  if (node.kind === Kind.FIELD) {
    if (!node.selectionSet) return depth;
    return calculateDepth(node.selectionSet, fragments, depth + 1);
  }

  if (node.kind === Kind.INLINE_FRAGMENT) {
    if (!node.selectionSet) return depth;
    return calculateDepth(node.selectionSet, fragments, depth);
  }

  if (node.kind === Kind.FRAGMENT_SPREAD) {
    const fragment = fragments[node.name.value];
    if (!fragment) return depth;
    return calculateDepth(fragment.selectionSet, fragments, depth);
  }

  return depth;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Count
// ─────────────────────────────────────────────────────────────────────────────

function countTokens(doc: DocumentNode): number {
  // Conservative approximation: count all AST nodes of key kinds
  let count = 0;
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.kind) count++;
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(doc);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Complexity Analysis — field-based cost model
// ─────────────────────────────────────────────────────────────────────────────

/** Unwrap NonNull wrappers to get the base output type */
function unwrapType(type: GraphQLOutputType): GraphQLOutputType {
  if (isNonNullType(type)) return unwrapType(type.ofType as GraphQLOutputType);
  return type;
}

function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLObjectType | null,
  fieldName: string,
): GraphQLField<unknown, unknown> | null {
  if (!parentType) return null;
  return parentType.getFields()[fieldName] ?? null;
}

function calculateComplexity(
  selectionSet: SelectionSetNode,
  fragments: Record<string, FragmentDefinitionNode>,
  schema: GraphQLSchema,
  parentType: GraphQLObjectType | null,
  listMultiplier: number,
): number {
  let total = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const fieldName = selection.name.value;

      // __typename is free
      if (fieldName === '__typename') continue;

      const fieldDef = getFieldDef(schema, parentType, fieldName);
      const isList = fieldDef ? isListType(unwrapType(fieldDef.type)) : false;

      // Base cost: 1 per field; list fields cost more
      const fieldCost = isList ? listMultiplier : 1;
      total += fieldCost;

      // Recurse into child selections
      if (selection.selectionSet) {
        let childParent: GraphQLObjectType | null = null;
        if (fieldDef) {
          const unwrapped = unwrapType(fieldDef.type);
          if (unwrapped instanceof GraphQLObjectType) childParent = unwrapped;
        }
        total += calculateComplexity(
          selection.selectionSet,
          fragments,
          schema,
          childParent,
          listMultiplier,
        );
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT && selection.selectionSet) {
      total += calculateComplexity(selection.selectionSet, fragments, schema, parentType, listMultiplier);
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = fragments[selection.name.value];
      if (fragment) {
        total += calculateComplexity(fragment.selectionSet, fragments, schema, parentType, listMultiplier);
      }
    }
  }

  return total;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apollo Server Plugin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GraphQLProtectionPlugin
 *
 * Per-request protection gate that runs BEFORE execution:
 *   1. Token count   — rejects abnormally long / large queries
 *   2. Depth limit   — rejects excessively nested queries
 *   3. Complexity    — rejects queries with high field-cost score
 *
 * Register via @Plugin() in a NestJS module.
 *
 * @example
 * // infrastructure/graphql/graphql.module.ts
 * providers: [GraphQLProtectionPlugin]
 */
@Plugin()
@Injectable()
export class GraphQLProtectionPlugin implements ApolloServerPlugin {
  private readonly logger = new Logger(GraphQLProtectionPlugin.name);
  private readonly config: Required<GraphQLProtectionConfig>;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      maxDepth:      configService.get<number>('graphql.maxDepth',      DEFAULTS.maxDepth),
      maxComplexity: configService.get<number>('graphql.maxComplexity', DEFAULTS.maxComplexity),
      listMultiplier:configService.get<number>('graphql.listMultiplier',DEFAULTS.listMultiplier),
      maxTokens:     configService.get<number>('graphql.maxTokens',     DEFAULTS.maxTokens),
    };
    this.logger.log(
      `GraphQL protection active — maxDepth:${this.config.maxDepth} ` +
        `maxComplexity:${this.config.maxComplexity} ` +
        `maxTokens:${this.config.maxTokens}`,
    );
  }

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const { maxDepth, maxComplexity, listMultiplier, maxTokens } = this.config;

    return {
      async didResolveOperation({ document, schema, operation }) {
        // ── Build fragment map ───────────────────────────────────────────────
        const fragments: Record<string, FragmentDefinitionNode> = {};
        for (const def of document.definitions) {
          if (def.kind === Kind.FRAGMENT_DEFINITION) {
            fragments[def.name.value] = def;
          }
        }

        const errors: GraphQLError[] = [];

        // ── 1. Token count limit ─────────────────────────────────────────────
        const tokens = countTokens(document);
        if (tokens > maxTokens) {
          errors.push(
            new GraphQLError(
              `Query too large: ${tokens} tokens exceeds the maximum of ${maxTokens}.`,
              { extensions: { code: 'QUERY_TOO_LARGE', tokens, maxTokens } },
            ),
          );
        }

        // ── 2. Depth limit ───────────────────────────────────────────────────
        if (operation?.kind === Kind.OPERATION_DEFINITION && operation.selectionSet) {
          const depth = calculateDepth(operation.selectionSet, fragments, 0);
          if (depth > maxDepth) {
            errors.push(
              new GraphQLError(
                `Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}.`,
                { extensions: { code: 'QUERY_DEPTH_EXCEEDED', depth, maxDepth } },
              ),
            );
          }

          // ── 3. Complexity limit ────────────────────────────────────────────
          const rootTypeName =
            operation.operation === 'mutation'
              ? schema.getMutationType()?.name
              : operation.operation === 'subscription'
                ? schema.getSubscriptionType()?.name
                : schema.getQueryType()?.name;

          const rootType =
            rootTypeName
              ? (schema.getType(rootTypeName) as GraphQLObjectType | null)
              : null;

          const complexity = calculateComplexity(
            operation.selectionSet,
            fragments,
            schema,
            rootType,
            listMultiplier,
          );

          if (complexity > maxComplexity) {
            errors.push(
              new GraphQLError(
                `Query complexity ${complexity} exceeds maximum allowed complexity of ${maxComplexity}.`,
                { extensions: { code: 'QUERY_COMPLEXITY_EXCEEDED', complexity, maxComplexity } },
              ),
            );
          }
        }

        if (errors.length > 0) {
          // Log all violations (helps detect scanning / probing)
          for (const err of errors) {
            this.logger.warn(`GraphQL protection violation: ${err.message}`);
          }
          throw errors[0];
        }
      },
    };
  }
}
