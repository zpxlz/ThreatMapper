import cx from 'classnames';
import { capitalize } from 'lodash-es';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { FaHistory } from 'react-icons/fa';
import { FiFilter } from 'react-icons/fi';
import {
  HiArchive,
  HiBell,
  HiChevronRight,
  HiDotsVertical,
  HiEye,
  HiEyeOff,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { IconContext } from 'react-icons/lib';
import {
  ActionFunctionArgs,
  generatePath,
  LoaderFunctionArgs,
  Outlet,
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Form } from 'react-router-dom';
import { toast } from 'sonner';
import { twMerge } from 'tailwind-merge';
import {
  Badge,
  Breadcrumb,
  BreadcrumbLink,
  Button,
  Card,
  Checkbox,
  CircleSpinner,
  createColumnHelper,
  Dropdown,
  DropdownItem,
  getRowSelectionColumn,
  IconButton,
  Modal,
  Popover,
  RowSelectionState,
  Select,
  SelectItem,
  SortingState,
  Table,
  TableSkeleton,
} from 'ui-components';

import { getComplianceApiClient, getScanResultsApiClient } from '@/api/api';
import {
  ApiDocsBadRequestResponse,
  ModelCompliance,
  ModelScanResultsReq,
} from '@/api/generated';
import { DFLink } from '@/components/DFLink';
import { ACCOUNT_CONNECTOR } from '@/components/hosts-connector/NoConnectors';
import { complianceType } from '@/components/scan-configure-forms/PostureScanConfigureForm';
import { PostureIcon } from '@/components/sideNavigation/icons/Posture';
import { POSTURE_STATUS_COLORS } from '@/constants/charts';
import { ApiLoaderDataType } from '@/features/common/data-component/scanHistoryApiLoader';
import { PostureResultChart } from '@/features/postures/components/PostureResultChart';
import { Mode, useTheme } from '@/theme/ThemeContext';
import { PostureSeverityType, ScanTypeEnum } from '@/types/common';
import { ApiError, makeRequest } from '@/utils/api';
import { formatMilliseconds } from '@/utils/date';
import { typedDefer, TypedDeferredData } from '@/utils/router';
import { DFAwait } from '@/utils/suspense';
import {
  getOrderFromSearchParams,
  getPageFromSearchParams,
  useSortingState,
} from '@/utils/table';
import { usePageNavigation } from '@/utils/usePageNavigation';

export interface FocusableElement {
  focus(options?: FocusOptions): void;
}
export const STATUSES: { [k: string]: string } = {
  INFO: 'info',
  PASS: 'pass',
  WARN: 'warn',
  NOTE: 'note',
  ALARM: 'alarm',
  OK: 'ok',
  SKIP: 'skip',
};
enum ActionEnumType {
  MASK = 'mask',
  UNMASK = 'unmask',
  DELETE = 'delete',
  DOWNLOAD = 'download',
  NOTIFY = 'notify',
}

type ScanResult = {
  totalStatus: number;
  statusCounts: { [key: string]: number };
  nodeName: string;
  nodeType: string;
  nodeId: string;
  timestamp: number;
  compliances: ModelCompliance[];
  pagination: {
    currentPage: number;
    totalRows: number;
  };
};

export type LoaderDataType = {
  error?: string;
  message?: string;
  data?: ScanResult;
};

const PAGE_SIZE = 15;

const getStatusSearch = (searchParams: URLSearchParams) => {
  return searchParams.getAll('status');
};
const getMaskSearch = (searchParams: URLSearchParams) => {
  return searchParams.getAll('mask');
};
const getUnmaskSearch = (searchParams: URLSearchParams) => {
  return searchParams.getAll('unmask');
};

const getBenchmarkType = (searchParams: URLSearchParams) => {
  return searchParams.getAll('benchmarkType');
};

async function getScans(
  scanId: string,
  searchParams: URLSearchParams,
): Promise<LoaderDataType> {
  const status = getStatusSearch(searchParams);
  const page = getPageFromSearchParams(searchParams);
  const order = getOrderFromSearchParams(searchParams);
  const mask = getMaskSearch(searchParams);
  const unmask = getUnmaskSearch(searchParams);
  const benchmarkTypes = getBenchmarkType(searchParams);

  const scanResultsReq: ModelScanResultsReq = {
    fields_filter: {
      contains_filter: {
        filter_in: {},
      },
      match_filter: { filter_in: {} },
      order_filter: { order_fields: [] },
    },
    scan_id: scanId,
    window: {
      offset: page * PAGE_SIZE,
      size: PAGE_SIZE,
    },
  };

  if (status.length) {
    scanResultsReq.fields_filter.contains_filter.filter_in!['status'] = status;
  }

  if ((mask.length || unmask.length) && !(mask.length && unmask.length)) {
    scanResultsReq.fields_filter.contains_filter.filter_in!['masked'] = [
      mask.length ? true : false,
    ];
  }

  if (benchmarkTypes.length) {
    scanResultsReq.fields_filter.contains_filter.filter_in!['compliance_check_type'] =
      benchmarkTypes;
  }

  if (order) {
    scanResultsReq.fields_filter.order_filter.order_fields?.push({
      field_name: order.sortBy,
      descending: order.descending,
    });
  }

  let result = null;
  let resultCounts = null;

  result = await makeRequest({
    apiFunction: getComplianceApiClient().resultComplianceScan,
    apiArgs: [
      {
        modelScanResultsReq: scanResultsReq,
      },
    ],
    errorHandler: async (r) => {
      const error = new ApiError<{ message?: string }>({});
      if (r.status === 400 || r.status === 404) {
        const modelResponse: ApiDocsBadRequestResponse = await r.json();
        return error.set({
          message: modelResponse.message ?? '',
        });
      }
    },
  });
  resultCounts = await makeRequest({
    apiFunction: getComplianceApiClient().resultCountComplianceScan,
    apiArgs: [
      {
        modelScanResultsReq: {
          ...scanResultsReq,
          window: {
            ...scanResultsReq.window,
            size: 10 * scanResultsReq.window.size,
          },
        },
      },
    ],
    errorHandler: async (r) => {
      const error = new ApiError<{ message?: string }>({});
      if (r.status === 400 || r.status === 404) {
        const modelResponse: ApiDocsBadRequestResponse = await r.json();
        return error.set({
          message: modelResponse.message,
        });
      }
    },
  });
  if (ApiError.isApiError(result)) {
    return result.value();
  }
  if (ApiError.isApiError(resultCounts)) {
    return resultCounts.value();
  }

  const totalStatus = Object.values(result.status_counts ?? {}).reduce((acc, value) => {
    acc = acc + value;
    return acc;
  }, 0);

  const linuxComplianceStatus = {
    info: result.status_counts?.[STATUSES.INFO] ?? 0,
    pass: result.status_counts?.[STATUSES.PASS] ?? 0,
    warn: result.status_counts?.[STATUSES.WARN] ?? 0,
    note: result.status_counts?.[STATUSES.NOTE] ?? 0,
  };

  const clusterComplianceStatus = {
    alarm: result.status_counts?.[STATUSES.ALARM] ?? 0,
    info: result.status_counts?.[STATUSES.INFO] ?? 0,
    ok: result.status_counts?.[STATUSES.OK] ?? 0,
    skip: result.status_counts?.[STATUSES.SKIP] ?? 0,
  };

  return {
    data: {
      totalStatus,
      statusCounts:
        result.node_type === 'host' ? linuxComplianceStatus : clusterComplianceStatus,
      nodeName: result.node_name,
      nodeType: result.node_type,
      nodeId: result.node_id,
      timestamp: result.updated_at,
      compliances: result.compliances ?? [],
      pagination: {
        currentPage: page,
        totalRows: page * PAGE_SIZE + resultCounts.count,
      },
    },
  };
}

const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedDeferredData<LoaderDataType>> => {
  const scanId = params?.scanId ?? '';

  if (!scanId) {
    throw new Error('Scan Id is required');
  }
  const searchParams = new URL(request.url).searchParams;

  return typedDefer({
    data: getScans(scanId, searchParams),
  });
};

type ActionFunctionType =
  | ReturnType<typeof getScanResultsApiClient>['deleteScanResult']
  | ReturnType<typeof getScanResultsApiClient>['maskScanResult']
  | ReturnType<typeof getScanResultsApiClient>['notifyScanResult']
  | ReturnType<typeof getScanResultsApiClient>['unmaskScanResult'];

const action = async ({
  params: { scanId = '' },
  request,
}: ActionFunctionArgs): Promise<null> => {
  const formData = await request.formData();
  const ids = (formData.getAll('ids[]') ?? []) as string[];
  const actionType = formData.get('actionType');
  const _scanId = scanId;
  if (!_scanId) {
    throw new Error('Scan ID is required');
  }
  if (!actionType) {
    return null;
  }

  let result = null;
  let apiFunction: ActionFunctionType | null = null;
  if (actionType === ActionEnumType.DELETE || actionType === ActionEnumType.NOTIFY) {
    apiFunction =
      actionType === ActionEnumType.DELETE
        ? getScanResultsApiClient().deleteScanResult
        : getScanResultsApiClient().notifyScanResult;
    result = await makeRequest({
      apiFunction: apiFunction,
      apiArgs: [
        {
          modelScanResultsActionRequest: {
            result_ids: [...ids],
            scan_id: _scanId,
            scan_type: ScanTypeEnum.ComplianceScan,
          },
        },
      ],
      errorHandler: async (r) => {
        const error = new ApiError<{
          message?: string;
        }>({});
        if (r.status === 400 || r.status === 409) {
          const modelResponse: ApiDocsBadRequestResponse = await r.json();
          return error.set({
            message: modelResponse.message ?? '',
          });
        }
      },
    });
  } else if (actionType === ActionEnumType.MASK || actionType === ActionEnumType.UNMASK) {
    apiFunction =
      actionType === ActionEnumType.MASK
        ? getScanResultsApiClient().maskScanResult
        : getScanResultsApiClient().unmaskScanResult;
    result = await makeRequest({
      apiFunction: apiFunction,
      apiArgs: [
        {
          modelScanResultsMaskRequest: {
            result_ids: [...ids],
            scan_id: _scanId,
            scan_type: ScanTypeEnum.ComplianceScan,
          },
        },
      ],
      errorHandler: async (r) => {
        const error = new ApiError<{
          message?: string;
        }>({});
        if (r.status === 400 || r.status === 409) {
          const modelResponse: ApiDocsBadRequestResponse = await r.json();
          return error.set({
            message: modelResponse.message ?? '',
          });
        }
      },
    });
  }

  if (ApiError.isApiError(result)) {
    if (result.value()?.message !== undefined) {
      const message = result.value()?.message ?? 'Something went wrong';
      toast.error(message);
    }
  }

  if (actionType === ActionEnumType.DELETE) {
    toast.success('Deleted successfully');
  } else if (actionType === ActionEnumType.NOTIFY) {
    toast.success('Notified successfully');
  } else if (actionType === ActionEnumType.MASK) {
    toast.success('Masked successfully');
  } else if (actionType === ActionEnumType.UNMASK) {
    toast.success('Unmasked successfully');
  }
  return null;
};

const DeleteConfirmationModal = ({
  showDialog,
  ids,
  setShowDialog,
}: {
  showDialog: boolean;
  ids: string[];
  setShowDialog: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const fetcher = useFetcher();

  const onDeleteAction = useCallback(
    (actionType: string) => {
      const formData = new FormData();
      formData.append('actionType', actionType);
      ids.forEach((item) => formData.append('ids[]', item));
      fetcher.submit(formData, {
        method: 'post',
      });
    },
    [ids, fetcher],
  );

  return (
    <Modal open={showDialog} onOpenChange={() => setShowDialog(false)}>
      <div className="grid place-items-center p-6">
        <IconContext.Provider
          value={{
            className: 'mb-3 dark:text-red-600 text-red-400 w-[70px] h-[70px]',
          }}
        >
          <HiOutlineExclamationCircle />
        </IconContext.Provider>
        <h3 className="mb-4 font-normal text-center text-sm">
          The selected compliances will be deleted.
          <br />
          <span>Are you sure you want to delete?</span>
        </h3>
        <div className="flex items-center justify-right gap-4">
          <Button size="xs" onClick={() => setShowDialog(false)}>
            No, cancel
          </Button>
          <Button
            size="xs"
            color="danger"
            type="button"
            onClick={() => {
              onDeleteAction(ActionEnumType.DELETE);
              setShowDialog(false);
            }}
          >
            Yes, I&apos;m sure
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const HistoryDropdown = () => {
  const { navigate } = usePageNavigation();
  const fetcher = useFetcher<ApiLoaderDataType>();
  const loaderData = useLoaderData() as LoaderDataType;
  const params = useParams();
  const isScanHistoryLoading = fetcher.state === 'loading';

  const onHistoryClick = (nodeType: string, nodeId: string) => {
    fetcher.load(
      generatePath('/data-component/scan-history/:scanType/:nodeType/:nodeId', {
        nodeId: nodeId,
        nodeType: nodeType,
        scanType: ScanTypeEnum.ComplianceScan,
      }),
    );
  };

  return (
    <Suspense
      fallback={
        <IconButton
          size="xs"
          color="primary"
          outline
          className="rounded-lg bg-transparent"
          icon={<FaHistory />}
          type="button"
          loading
        />
      }
    >
      <DFAwait resolve={loaderData.data ?? []}>
        {(resolvedData: LoaderDataType) => {
          const { data } = resolvedData;
          if (!data) {
            return null;
          }
          return (
            <Dropdown
              triggerAsChild
              onOpenChange={(open) => {
                if (open) onHistoryClick(data.nodeType, data.nodeId);
              }}
              content={
                <>
                  {fetcher?.data?.data?.map((item) => {
                    return (
                      <DropdownItem
                        className="text-sm"
                        key={item.scanId}
                        onClick={() => {
                          navigate(
                            generatePath('/posture/scan-results/:scanId', {
                              scanId: item.scanId,
                            }),
                            {
                              replace: true,
                            },
                          );
                        }}
                      >
                        <span
                          className={twMerge(
                            cx('flex items-center text-gray-700 dark:text-gray-400', {
                              'text-blue-600 dark:text-blue-500':
                                item.scanId === params.scanId,
                            }),
                          )}
                        >
                          {formatMilliseconds(item.updatedAt)}
                        </span>
                      </DropdownItem>
                    );
                  })}
                </>
              }
            >
              <IconButton
                size="xs"
                color="primary"
                outline
                className="rounded-lg bg-transparent"
                icon={<FaHistory />}
                type="button"
                loading={isScanHistoryLoading}
              />
            </Dropdown>
          );
        }}
      </DFAwait>
    </Suspense>
  );
};

const ActionDropdown = ({
  icon,
  ids,
  label,
}: {
  icon: React.ReactNode;
  ids: string[];
  label?: string;
}) => {
  const fetcher = useFetcher();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const onTableAction = useCallback(
    (actionType: string) => {
      const formData = new FormData();
      formData.append('actionType', actionType);
      ids.forEach((item) => formData.append('ids[]', item));
      fetcher.submit(formData, {
        method: 'post',
      });
    },
    [ids],
  );

  return (
    <>
      <DeleteConfirmationModal
        showDialog={showDeleteDialog}
        ids={ids}
        setShowDialog={setShowDeleteDialog}
      />
      <Dropdown
        triggerAsChild={true}
        align="end"
        content={
          <>
            <DropdownItem onClick={() => onTableAction(ActionEnumType.MASK)}>
              <IconContext.Provider
                value={{ className: 'text-gray-700 dark:text-gray-400' }}
              >
                <HiEyeOff />
              </IconContext.Provider>
              <span className="text-gray-700 dark:text-gray-400">Mask</span>
            </DropdownItem>
            <DropdownItem onClick={() => onTableAction(ActionEnumType.UNMASK)}>
              <IconContext.Provider
                value={{ className: 'text-gray-700 dark:text-gray-400' }}
              >
                <HiEye />
              </IconContext.Provider>
              <span className="text-gray-700 dark:text-gray-400">Un mask</span>
            </DropdownItem>
            <DropdownItem
              className="text-sm"
              onClick={() => onTableAction(ActionEnumType.NOTIFY)}
            >
              <span className="flex items-center gap-x-2 text-gray-700 dark:text-gray-400">
                <IconContext.Provider
                  value={{ className: 'text-gray-700 dark:text-gray-400' }}
                >
                  <HiBell />
                </IconContext.Provider>
                Notify
              </span>
            </DropdownItem>
            <DropdownItem
              className="text-sm"
              onClick={() => {
                setShowDeleteDialog(true);
              }}
            >
              <span className="flex items-center gap-x-2 text-red-700 dark:text-red-400">
                <IconContext.Provider
                  value={{ className: 'text-red-700 dark:text-red-400' }}
                >
                  <HiArchive />
                </IconContext.Provider>
                Delete
              </span>
            </DropdownItem>
          </>
        }
      >
        <Button size="xs" color="normal" className="hover:bg-transparent">
          <IconContext.Provider value={{ className: 'text-gray-700 dark:text-gray-400' }}>
            {icon}
          </IconContext.Provider>
          {label ? <span className="ml-2">{label}</span> : null}
        </Button>
      </Dropdown>
    </>
  );
};
const ScanResusltTable = () => {
  const fetcher = useFetcher();
  const loaderData = useLoaderData() as LoaderDataType;
  const columnHelper = createColumnHelper<ModelCompliance>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rowSelectionState, setRowSelectionState] = useState<RowSelectionState>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sort, setSort] = useSortingState();

  const columns = useMemo(() => {
    const columns = [
      getRowSelectionColumn(columnHelper, {
        size: 30,
        minSize: 30,
        maxSize: 40,
      }),
      columnHelper.accessor('node_id', {
        enableSorting: false,
        enableResizing: false,
        cell: (info) => (
          <DFLink
            to={{
              pathname: `./${info.getValue()}`,
              search: searchParams.toString(),
            }}
            className="flex items-center gap-x-2"
          >
            <div className="p-1.5 bg-gray-100 shrink-0 dark:bg-gray-500/10 rounded-lg">
              <div className="w-4 h-4">
                <PostureIcon />
              </div>
            </div>
            <div className="truncate">{info.row.original.test_number}</div>
          </DFLink>
        ),
        header: () => 'Test ID',
        minSize: 50,
        size: 60,
        maxSize: 65,
      }),
      columnHelper.accessor('test_category', {
        enableSorting: false,
        enableResizing: false,
        cell: (info) => info.getValue(),
        header: () => 'Category',
        minSize: 80,
        size: 90,
        maxSize: 95,
      }),
      columnHelper.accessor('compliance_check_type', {
        enableSorting: false,
        enableResizing: false,
        cell: (info) => info.getValue().toUpperCase(),
        header: () => 'Check Type',
        minSize: 60,
        size: 60,
        maxSize: 70,
      }),

      columnHelper.accessor('description', {
        enableResizing: false,
        enableSorting: false,
        minSize: 140,
        size: 150,
        maxSize: 160,
        header: () => 'Description',
        cell: (cell) => cell.getValue(),
      }),
      columnHelper.accessor('status', {
        enableResizing: false,
        minSize: 60,
        size: 60,
        maxSize: 65,
        header: () => <div>Status</div>,
        cell: (info) => {
          return (
            <Badge
              label={info.getValue().toUpperCase()}
              className={cx({
                'bg-[#F05252]/20 dark:bg-[#F05252]/20 text-red-500 dark:text-[#F05252]':
                  info.getValue().toLowerCase() === STATUSES.ALARM,
                'bg-[#3F83F8]/20 dark:bg-[#3F83F8/20 text-[blue-500 dark:text-[#3F83F8]':
                  info.getValue().toLowerCase() === STATUSES.INFO,
                'bg-[#0E9F6E]/30 dark:bg-[##0E9F6E]/10 text-green-500 dark:text-[#0E9F6E]':
                  info.getValue().toLowerCase() === STATUSES.OK,
                'bg-[#FF5A1F]/20 dark:bg-[#FF5A1F]/10 text-orange-500 dark:text-[#FF5A1F]':
                  info.getValue().toLowerCase() === STATUSES.WARN,
                'bg-[#6B7280]/20 dark:bg-[#6B7280]/10 text-gray-700 dark:text-gray-300':
                  info.getValue().toLowerCase() === STATUSES.SKIP,
                'bg-[#0E9F6E]/10 dark:bg-[#0E9F6E]/10 text-green-500 dark:text-[#0E9F6E]':
                  info.getValue().toLowerCase() === STATUSES.PASS,
                'bg-[#d6e184]/10 dark:bg-[#d6e184]/10 text-yellow-500 dark:text-[#d6e184]':
                  info.getValue().toLowerCase() === STATUSES.NOTE,
              })}
              size="sm"
            />
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        enableSorting: false,
        cell: (cell) => (
          <ActionDropdown icon={<HiDotsVertical />} ids={[cell.row.original.node_id]} />
        ),
        header: () => '',
        minSize: 40,
        size: 40,
        maxSize: 40,
        enableResizing: false,
      }),
    ];

    return columns;
  }, [setSearchParams]);

  return (
    <>
      <Suspense fallback={<TableSkeleton columns={6} rows={10} size={'md'} />}>
        <DFAwait resolve={loaderData.data}>
          {(resolvedData: LoaderDataType) => {
            const { data } = resolvedData;
            if (!data) {
              return <NotFound />;
            }
            return (
              <Form>
                {Object.keys(rowSelectionState).length === 0 ? (
                  <div className="text-sm text-gray-400 font-medium mb-3">
                    No rows selected
                  </div>
                ) : (
                  <>
                    <DeleteConfirmationModal
                      showDialog={showDeleteDialog}
                      ids={Object.keys(rowSelectionState)}
                      setShowDialog={setShowDeleteDialog}
                    />
                    <div className="mb-1.5 flex gap-x-2">
                      <Button
                        size="xxs"
                        color="danger"
                        outline
                        startIcon={<HiArchive />}
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        Delete
                      </Button>
                      <Button
                        size="xs"
                        color="default"
                        outline
                        startIcon={<HiEyeOff />}
                        type="submit"
                        onClick={() => {
                          const formData = new FormData();
                          formData.append('actionType', ActionEnumType.MASK);
                          Object.keys(rowSelectionState).forEach((item) =>
                            formData.append('ids[]', item),
                          );
                          fetcher.submit(formData, {
                            method: 'post',
                          });
                        }}
                      >
                        Mask
                      </Button>
                      <Button
                        size="xs"
                        color="default"
                        outline
                        startIcon={<HiEye />}
                        type="submit"
                        onClick={() => {
                          const formData = new FormData();
                          formData.append('actionType', ActionEnumType.UNMASK);
                          Object.keys(rowSelectionState).forEach((item) =>
                            formData.append('ids[]', item),
                          );
                          fetcher.submit(formData, {
                            method: 'post',
                          });
                        }}
                      >
                        Un mask
                      </Button>
                    </div>
                  </>
                )}

                <Table
                  size="sm"
                  data={data.compliances}
                  columns={columns}
                  enableRowSelection
                  rowSelectionState={rowSelectionState}
                  onRowSelectionChange={setRowSelectionState}
                  enablePagination
                  manualPagination
                  enableColumnResizing
                  totalRows={data.pagination.totalRows}
                  pageSize={PAGE_SIZE}
                  pageIndex={data.pagination.currentPage}
                  enableSorting
                  manualSorting
                  sortingState={sort}
                  getRowId={(row) => {
                    return row.node_id;
                  }}
                  onPaginationChange={(updaterOrValue) => {
                    let newPageIndex = 0;
                    if (typeof updaterOrValue === 'function') {
                      newPageIndex = updaterOrValue({
                        pageIndex: data.pagination.currentPage,
                        pageSize: PAGE_SIZE,
                      }).pageIndex;
                    } else {
                      newPageIndex = updaterOrValue.pageIndex;
                    }
                    setSearchParams((prev) => {
                      prev.set('page', String(newPageIndex));
                      return prev;
                    });
                  }}
                  onSortingChange={(updaterOrValue) => {
                    let newSortState: SortingState = [];
                    if (typeof updaterOrValue === 'function') {
                      newSortState = updaterOrValue(sort);
                    } else {
                      newSortState = updaterOrValue;
                    }
                    setSearchParams((prev) => {
                      if (!newSortState.length) {
                        prev.delete('sortby');
                        prev.delete('desc');
                      } else {
                        prev.set('sortby', String(newSortState[0].id));
                        prev.set('desc', String(newSortState[0].desc));
                      }
                      return prev;
                    });
                    setSort(newSortState);
                  }}
                  getTrProps={(row) => {
                    if (row.original.masked) {
                      return {
                        className: 'opacity-40',
                      };
                    }
                    return {};
                  }}
                />
              </Form>
            );
          }}
        </DFAwait>
      </Suspense>
    </>
  );
};

const FilterComponent = () => {
  const elementToFocusOnClose = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams() as {
    nodeType: string;
  };

  let statuses: string[] = [];
  if (params.nodeType === ACCOUNT_CONNECTOR.HOST) {
    statuses = [STATUSES.INFO, STATUSES.PASS, STATUSES.WARN, STATUSES.NOTE];
  } else {
    statuses = [STATUSES.ALARM, STATUSES.INFO, STATUSES.OK, STATUSES.SKIP];
  }

  let benchmarks: string[] = [];
  if (params.nodeType === ACCOUNT_CONNECTOR.HOST) {
    benchmarks = complianceType.host;
  } else {
    benchmarks = complianceType.kubernetes_cluster;
  }

  return (
    <Popover
      triggerAsChild
      elementToFocusOnCloseRef={elementToFocusOnClose}
      content={
        <div className="dark:text-white p-4 w-[300px]">
          <div className="flex flex-col gap-y-6">
            <fieldset>
              <legend className="text-sm font-medium">Mask And Unmask</legend>
              <div className="flex gap-x-4 mt-1">
                <Checkbox
                  label="Mask"
                  checked={searchParams.getAll('mask').includes('true')}
                  onCheckedChange={(state) => {
                    if (state) {
                      setSearchParams((prev) => {
                        prev.append('mask', 'true');
                        prev.delete('page');
                        return prev;
                      });
                    } else {
                      setSearchParams((prev) => {
                        const prevStatuses = prev.getAll('mask');
                        prev.delete('mask');
                        prevStatuses
                          .filter((mask) => mask !== 'true')
                          .forEach((mask) => {
                            prev.append('mask', mask);
                          });
                        prev.delete('mask');
                        prev.delete('page');
                        return prev;
                      });
                    }
                  }}
                />
                <Checkbox
                  label="Unmask"
                  checked={searchParams.getAll('unmask').includes('true')}
                  onCheckedChange={(state) => {
                    if (state) {
                      setSearchParams((prev) => {
                        prev.append('unmask', 'true');
                        prev.delete('page');
                        return prev;
                      });
                    } else {
                      setSearchParams((prev) => {
                        const prevStatuses = prev.getAll('unmask');
                        prev.delete('unmask');
                        prevStatuses
                          .filter((status) => status !== 'true')
                          .forEach((status) => {
                            prev.append('unmask', status);
                          });
                        prev.delete('unmask');
                        prev.delete('page');
                        return prev;
                      });
                    }
                  }}
                />
              </div>
            </fieldset>
            <fieldset>
              <Select
                noPortal
                name="benchmarkType"
                label={'Benchmark Type'}
                placeholder="Select Benchmark Type"
                value={searchParams.getAll('benchmarkType')}
                sizing="xs"
                onChange={(value) => {
                  setSearchParams((prev) => {
                    prev.delete('benchmarkType');
                    value.forEach((benchmarkType) => {
                      prev.append('benchmarkType', benchmarkType);
                    });
                    prev.delete('page');
                    return prev;
                  });
                }}
              >
                {benchmarks.map((status: string) => {
                  return (
                    <SelectItem value={status.toLowerCase()} key={status.toLowerCase()}>
                      {status.toUpperCase()}
                    </SelectItem>
                  );
                })}
              </Select>
            </fieldset>
            <fieldset>
              <Select
                noPortal
                name="status"
                label={'Status'}
                placeholder="Select Status"
                value={searchParams.getAll('status')}
                sizing="xs"
                onChange={(value) => {
                  setSearchParams((prev) => {
                    prev.delete('status');
                    value.forEach((language) => {
                      prev.append('status', language);
                    });
                    prev.delete('page');
                    return prev;
                  });
                }}
              >
                {statuses.map((status: string) => {
                  return (
                    <SelectItem value={status.toLowerCase()} key={status.toLowerCase()}>
                      {status.toUpperCase()}
                    </SelectItem>
                  );
                })}
              </Select>
            </fieldset>
          </div>
        </div>
      }
    >
      <IconButton
        size="xs"
        outline
        color="primary"
        className="rounded-lg bg-transparent"
        icon={<FiFilter />}
      />
    </Popover>
  );
};
const HeaderComponent = () => {
  const [searchParams] = useSearchParams();
  const params = useParams() as {
    nodeType: string;
  };
  const loaderData = useLoaderData() as LoaderDataType;
  const isFilterApplied =
    searchParams.has('status') ||
    searchParams.has('mask') ||
    searchParams.has('unmask') ||
    searchParams.has('benchmarkType');

  return (
    <div className="flex p-1 pl-2 w-full items-center shadow bg-white dark:bg-gray-800">
      <Suspense fallback={<CircleSpinner size="xs" />}>
        <DFAwait resolve={loaderData.data ?? []}>
          {(resolvedData: LoaderDataType) => {
            const { data } = resolvedData;

            const _nodeType =
              params.nodeType === ACCOUNT_CONNECTOR.LINUX
                ? ACCOUNT_CONNECTOR.LINUX
                : ACCOUNT_CONNECTOR.KUBERNETES;
            return (
              <>
                <Breadcrumb separator={<HiChevronRight />} transparent>
                  <BreadcrumbLink>
                    <DFLink to={'/posture'}>POSTURE</DFLink>
                  </BreadcrumbLink>
                  <BreadcrumbLink>
                    <DFLink
                      to={generatePath('/posture/accounts/:nodeType', {
                        nodeType: _nodeType,
                      })}
                    >
                      {_nodeType}
                    </DFLink>
                  </BreadcrumbLink>

                  {data ? (
                    <BreadcrumbLink>
                      <span className="inherit cursor-auto">{data.nodeName}</span>
                    </BreadcrumbLink>
                  ) : null}
                </Breadcrumb>
              </>
            );
          }}
        </DFAwait>
      </Suspense>
      <div className="ml-auto flex items-center gap-x-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 dark:text-gray-200">
            <Suspense fallback={<CircleSpinner size="xs" />}>
              <DFAwait resolve={loaderData.data ?? []}>
                {(resolvedData: LoaderDataType) => {
                  const { data } = resolvedData;
                  if (!data) {
                    return null;
                  }
                  return formatMilliseconds(data.timestamp);
                }}
              </DFAwait>
            </Suspense>
          </span>
          <span className="text-gray-400 text-[10px]">Last scan</span>
        </div>

        <HistoryDropdown />

        <div className="relative">
          {isFilterApplied && (
            <span className="absolute left-0 top-0 inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
          )}
          <FilterComponent />
        </div>
      </div>
    </div>
  );
};

const StatusCountComponent = ({ theme }: { theme: Mode }) => {
  const loaderData = useLoaderData() as LoaderDataType;
  const params = useParams() as {
    nodeType: string;
  };
  const statuses =
    params.nodeType === ACCOUNT_CONNECTOR.HOST
      ? [
          POSTURE_STATUS_COLORS['info'],
          POSTURE_STATUS_COLORS['pass'],
          POSTURE_STATUS_COLORS['warn'],
          POSTURE_STATUS_COLORS['note'],
        ]
      : [
          POSTURE_STATUS_COLORS['alarm'],
          POSTURE_STATUS_COLORS['info'],
          POSTURE_STATUS_COLORS['ok'],
          POSTURE_STATUS_COLORS['skip'],
        ];

  return (
    <Card className="p-4 grid grid-flow-row-dense gap-y-8">
      <Suspense
        fallback={
          <div className="min-h-[300px] flex items-center justify-center">
            <CircleSpinner size="md" />
          </div>
        }
      >
        <DFAwait resolve={loaderData.data}>
          {(resolvedData: LoaderDataType) => {
            const { data } = resolvedData;

            return (
              <>
                <div className="grid grid-flow-col-dense gap-x-4">
                  <div className="bg-red-100 dark:bg-red-500/10 rounded-lg flex items-center justify-center">
                    <div className="w-14 h-14 text-red-500 dark:text-red-400">
                      <PostureIcon />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 dark:text-gray-200 tracking-wider">
                      Total Compliances
                    </h4>
                    <div className="mt-2">
                      <span className="text-2xl text-gray-900 dark:text-gray-200">
                        {data?.totalStatus}
                      </span>
                      <h5 className="text-xs text-gray-500 dark:text-gray-200 mb-2">
                        Total count
                      </h5>
                      <div>
                        <span className="text-sm text-gray-900 dark:text-gray-200">
                          {0}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          Active containers
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-[200px]">
                  <PostureResultChart
                    theme={theme}
                    data={data?.statusCounts ?? {}}
                    eoption={{
                      series: [
                        {
                          color: statuses,
                        },
                      ],
                    }}
                  />
                </div>
                <div>
                  {Object.keys(data?.statusCounts ?? {})?.map((key: string) => {
                    return (
                      <div key={key} className="flex items-center gap-2 p-1">
                        <div
                          className={cx('h-3 w-3 rounded-full')}
                          style={{
                            backgroundColor:
                              POSTURE_STATUS_COLORS[
                                key.toLowerCase() as PostureSeverityType
                              ],
                          }}
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-200">
                          {capitalize(key)}
                        </span>
                        <span
                          className={cx(
                            'text-sm text-gray-900 dark:text-gray-200 ml-auto tabular-nums',
                          )}
                        >
                          {data?.statusCounts[key]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          }}
        </DFAwait>
      </Suspense>
    </Card>
  );
};

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center mt-40">
      <div className="h-16 w-16">
        <PostureIcon />
      </div>
      <span className="text-2xl font-medium text-gray-700 dark:text-white">
        No Result Found
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Scan your account to get compliance results
      </span>
    </div>
  );
};
const PostureScanResults = () => {
  const { mode } = useTheme();

  return (
    <>
      <HeaderComponent />
      <div className="grid grid-cols-[400px_1fr] p-2 gap-x-2">
        <div className="self-start grid gap-y-2">
          <StatusCountComponent theme={mode} />
        </div>
        <ScanResusltTable />
      </div>
      <Outlet />
    </>
  );
};

export const module = {
  action,
  loader,
  element: <PostureScanResults />,
};