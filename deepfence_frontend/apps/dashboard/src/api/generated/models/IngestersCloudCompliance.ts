/* tslint:disable */
/* eslint-disable */
/**
 * Deepfence ThreatMapper
 * Deepfence Runtime API provides programmatic control over Deepfence microservice securing your container, kubernetes and cloud deployments. The API abstracts away underlying infrastructure details like cloud provider,  container distros, container orchestrator and type of deployment. This is one uniform API to manage and control security alerts, policies and response to alerts for microservices running anywhere i.e. managed pure greenfield container deployments or a mix of containers, VMs and serverless paradigms like AWS Fargate.
 *
 * The version of the OpenAPI document: 2.0.0
 * Contact: community@deepfence.io
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
/**
 * 
 * @export
 * @interface IngestersCloudCompliance
 */
export interface IngestersCloudCompliance {
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    timestamp?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    account_id?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    cloud_provider?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    compliance_check_type?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    control_id?: string;
    /**
     * 
     * @type {number}
     * @memberof IngestersCloudCompliance
     */
    count?: number;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    description?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    doc_id?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    group?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    reason?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    region?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    resource?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    scan_id?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    service?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    severity?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    status?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    title?: string;
    /**
     * 
     * @type {string}
     * @memberof IngestersCloudCompliance
     */
    type?: string;
}

/**
 * Check if a given object implements the IngestersCloudCompliance interface.
 */
export function instanceOfIngestersCloudCompliance(value: object): boolean {
    let isInstance = true;

    return isInstance;
}

export function IngestersCloudComplianceFromJSON(json: any): IngestersCloudCompliance {
    return IngestersCloudComplianceFromJSONTyped(json, false);
}

export function IngestersCloudComplianceFromJSONTyped(json: any, ignoreDiscriminator: boolean): IngestersCloudCompliance {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'timestamp': !exists(json, '@timestamp') ? undefined : json['@timestamp'],
        'account_id': !exists(json, 'account_id') ? undefined : json['account_id'],
        'cloud_provider': !exists(json, 'cloud_provider') ? undefined : json['cloud_provider'],
        'compliance_check_type': !exists(json, 'compliance_check_type') ? undefined : json['compliance_check_type'],
        'control_id': !exists(json, 'control_id') ? undefined : json['control_id'],
        'count': !exists(json, 'count') ? undefined : json['count'],
        'description': !exists(json, 'description') ? undefined : json['description'],
        'doc_id': !exists(json, 'doc_id') ? undefined : json['doc_id'],
        'group': !exists(json, 'group') ? undefined : json['group'],
        'reason': !exists(json, 'reason') ? undefined : json['reason'],
        'region': !exists(json, 'region') ? undefined : json['region'],
        'resource': !exists(json, 'resource') ? undefined : json['resource'],
        'scan_id': !exists(json, 'scan_id') ? undefined : json['scan_id'],
        'service': !exists(json, 'service') ? undefined : json['service'],
        'severity': !exists(json, 'severity') ? undefined : json['severity'],
        'status': !exists(json, 'status') ? undefined : json['status'],
        'title': !exists(json, 'title') ? undefined : json['title'],
        'type': !exists(json, 'type') ? undefined : json['type'],
    };
}

export function IngestersCloudComplianceToJSON(value?: IngestersCloudCompliance | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        '@timestamp': value.timestamp,
        'account_id': value.account_id,
        'cloud_provider': value.cloud_provider,
        'compliance_check_type': value.compliance_check_type,
        'control_id': value.control_id,
        'count': value.count,
        'description': value.description,
        'doc_id': value.doc_id,
        'group': value.group,
        'reason': value.reason,
        'region': value.region,
        'resource': value.resource,
        'scan_id': value.scan_id,
        'service': value.service,
        'severity': value.severity,
        'status': value.status,
        'title': value.title,
        'type': value.type,
    };
}

