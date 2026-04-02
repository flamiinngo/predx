import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { grpc } from "@improbable-eng/grpc-web";
export declare const protobufPackage = "initia.abcipp.mempool.v1";
/**
 * QueryTxDistributionRequest is the request type for the Query.QueryTxDistribution
 * RPC method.
 */
export interface QueryTxDistributionRequest {
}
/**
 * QueryTxDistributionResponse is the response type for the Query.QueryTxDistribution
 * RPC method.
 */
export interface QueryTxDistributionResponse {
    /** Distribution is a map of lane to the number of transactions in the mempool for that lane. */
    distribution: Map<string, bigint>;
}
export interface QueryTxDistributionResponse_DistributionEntry {
    key: string;
    value: bigint;
}
/**
 * QueryTxHashRequest is the request type for the Query.QueryTxHash
 * RPC method.
 */
export interface QueryTxHashRequest {
    sender: string;
    sequence: string;
}
/**
 * QueryTxHashResponse is the response type for the Query.QueryTxHash
 * RPC method.
 */
export interface QueryTxHashResponse {
    txHash: string;
}
export declare const QueryTxDistributionRequest: MessageFns<QueryTxDistributionRequest>;
export declare const QueryTxDistributionResponse: MessageFns<QueryTxDistributionResponse>;
export declare const QueryTxDistributionResponse_DistributionEntry: MessageFns<QueryTxDistributionResponse_DistributionEntry>;
export declare const QueryTxHashRequest: MessageFns<QueryTxHashRequest>;
export declare const QueryTxHashResponse: MessageFns<QueryTxHashResponse>;
/** Query provides defines the gRPC querier service */
export interface Query {
    /** QueryTxDistribution returns the distribution of transactions in the mempool. */
    QueryTxDistribution(request: DeepPartial<QueryTxDistributionRequest>, metadata?: grpc.Metadata): Promise<QueryTxDistributionResponse>;
    /** QueryTxHash checks if a transaction is in the mempool. */
    QueryTxHash(request: DeepPartial<QueryTxHashRequest>, metadata?: grpc.Metadata): Promise<QueryTxHashResponse>;
}
export declare class QueryClientImpl implements Query {
    private readonly rpc;
    constructor(rpc: Rpc);
    QueryTxDistribution(request: DeepPartial<QueryTxDistributionRequest>, metadata?: grpc.Metadata): Promise<QueryTxDistributionResponse>;
    QueryTxHash(request: DeepPartial<QueryTxHashRequest>, metadata?: grpc.Metadata): Promise<QueryTxHashResponse>;
}
export declare const QueryDesc: {
    serviceName: string;
};
export declare const QueryQueryTxDistributionDesc: UnaryMethodDefinitionish;
export declare const QueryQueryTxHashDesc: UnaryMethodDefinitionish;
interface UnaryMethodDefinitionishR extends grpc.UnaryMethodDefinition<any, any> {
    requestStream: any;
    responseStream: any;
}
type UnaryMethodDefinitionish = UnaryMethodDefinitionishR;
interface Rpc {
    unary<T extends UnaryMethodDefinitionish>(methodDesc: T, request: any, metadata: grpc.Metadata | undefined): Promise<any>;
}
export declare class GrpcWebImpl {
    private host;
    private options;
    constructor(host: string, options: {
        transport?: grpc.TransportFactory;
        debug?: boolean;
        metadata?: grpc.Metadata;
        upStreamRetryCodes?: number[];
    });
    unary<T extends UnaryMethodDefinitionish>(methodDesc: T, _request: any, metadata: grpc.Metadata | undefined): Promise<any>;
}
declare const gt: any;
type Builtin = Date | Function | Uint8Array | string | number | boolean | bigint | undefined;
export type DeepPartial<T> = T extends Builtin ? T : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export declare class GrpcWebError extends gt.Error {
    code: grpc.Code;
    metadata: grpc.Metadata;
    constructor(message: string, code: grpc.Code, metadata: grpc.Metadata);
}
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
    fromJSON(object: any): T;
    toJSON(message: T): unknown;
    create(base?: DeepPartial<T>): T;
    fromPartial(object: DeepPartial<T>): T;
}
export {};
