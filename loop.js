(function(){

    let transform = getTransform();
    let defaultOptions = {
        autoplay: false,
        showPagination: true,
        speed: 800,
        duration: 3000,
        timer: null,
        childLength: 0,
        startX: 0,
        startY: 0,
        distance: 0,
        slideIndex: 1, // 移动位置标记
        container: null,
        prev: query('.prev'),
        next: query('.next'),
    }

    function Loop(selector, options) {
        defaultOptions.container = document.getElementById(selector);
        this.options = mergeObj(defaultOptions, options);
        this.init();
    }
    Loop.prototype = {
        constructor: Loop,

        init: function() {

            // 复制第一个子元素，并添加到父容器最后
            this.copyNode();

            // 获取wrapper宽度
            let parentNode = this.options.container.parentNode;
            let singleWidth = parseInt(getStyle(parentNode, 'width'));

            // 设置单次移动的距离为单个元素的宽度
            this.options.distance = singleWidth;

            // 获取子元素个数
            let len = this.options.childLength = this.options.container.children.length;
            this.showPagination(len - 1)

            // 设置父容器宽度
            this.options.container.style.width = (singleWidth * this.options.childLength) + 'px';

            // 自动播放
            this.autoPlay();

            // 执行点击及相关操作
            this.handleEvents();
            this.move = this._throttle(len - 1);
        },
        /**
         * 自动播放
         */
        autoPlay: function(){
            // 轮播图在标签切换或者窗口最小化后再次进入时会出现样式混乱的问题，
            // 添加窗口的onblur和onfocus事件来控制定时器的开始及关闭
            if(this.options.autoplay === true){
                clearInterval(this.options.timer);
                this.options.timer = setInterval(() => {
                    this.move('left');
                }, this.options.duration)

                this.handleBlurOrFocus();
            }
        },
        /**
         * 监听轮播图是否在可视区域
         */
        handleBlurOrFocus () {
            let self = this;
            document.addEventListener("visibilitychange", function() {
                let isHidden = document.hidden;
                if (isHidden) {
                    clearInterval(self.options.timer);
                    self.options.timer = null;
                } else {
                    self.move('left');
                    self.options.timer = setInterval(() => {
                        self.move('left');
                    }, self.options.duration)
                }
            });
        },
        /**
         *  添加分页标签
         * @param len
         */
        showPagination (len) {
            let paginationWrapper = document.getElementById('pagination-wrapper');
            let fragment = document.createDocumentFragment();
            for (let i = 1; i <= len; i++) {
                let str = document.createElement('p');
                str.setAttribute('pagination-index', i);
                str.setAttribute('isLast', 'false');
                if (i === 1) {
                    str.className = 'active'
                }
                fragment.appendChild(str)
            }
            paginationWrapper.appendChild(fragment)
        },
        /**
         * 修改pagination状态
         */
        changePaginationActive (len) {
            let childrenPaginations = query('#pagination-wrapper').children;
            childrenPaginations = Array.prototype.slice.call(childrenPaginations, 0)

            childrenPaginations.forEach((item, index) => {
                let paginationIndex = Number(item.getAttribute('pagination-index'));

                if (paginationIndex === this.options.slideIndex) {
                    addClass(item, 'active');
                } else {
                    removeClass(item, 'active')
                }

                if (this.options.slideIndex === len + 1) {
                    if (paginationIndex === 1) {
                        addClass(item, 'active');
                    } else {
                        removeClass(item, 'active')
                    }
                }
            })
        },

        /**
         * 对滑动效果进行节流处理
         */
        _throttle: function(len) {
            let self = this;
            self.stepTimer = null;
            self.hasRa = window.requestAnimationFrame;

            // 标记pagination的位置
            // 从1 至 pagination.length + 1
            let innderIndex = 1;

            return throttle( function(){
                let argument = Array.prototype.slice.call(arguments);
                let direct = argument[0];
                let coefficient = argument[1] || 1;

                if (direct === 'left') {
                    self.options.slideIndex ++;
                    innderIndex ++
                } else {
                    self.options.slideIndex --;
                    innderIndex --;
                }

                /**
                 * 移动动作开始前，要设置父容器的位置
                 * 由于初始化时向末尾添加了第一个元素，这里所说的最后一个元素其实就是倒数第二个元素
                 */
                // 最后一个元素过渡到第一个元素
                if (self.options.slideIndex === len + 2) {
                    self.transformNow(0); // 设置位置
                    self.options.slideIndex = 2;  // 更改标记值
                }
                // 第一个元素过渡到倒数最后一个元素
                if(self.options.slideIndex === 0) {
                    self.transformNow(-self.options.distance * len); // 设置位置
                    self.options.slideIndex = len// 更改标记值
                }

                self.changePaginationActive(len);

                /**
                 * 实现平滑滑动效果
                 * 方法一：requestAnimationFrame(有兼容性)
                 * 方法二：setInterval
                 */
                let summaryDistance = 0, // 累加移动距离
                    pos = this.getPosition(); // 获取已经移动的距离
                if (self.hasRa) {
                    self.stepTimer = requestAnimationFrame(self.stepFunc(direct, summaryDistance, pos, coefficient))
                } else {
                    self.stepTimer = setInterval(self.stepFunc(direct, summaryDistance, pos, coefficient), 17);
                }
            }, self.options.speed)
        },
        /**
         * 分割移动步骤
         * @param direction         方向
         * @param summaryDistance   累加距离
         * @param pos               移动距离
         * @param coefficient       移动系数(用于点击分页码)
         * @returns {_stepFunc}
         */
        stepFunc: function(direction, summaryDistance, pos, coefficient) {
            let self = this;
            let realDistance = self.options.distance * coefficient;
            return function _stepFunc () {
                // 每一次移动的距离(将每一次移动的距离分割成多步)
                let stepDistance = (realDistance / self.options.speed) * 17;
                summaryDistance += stepDistance;
                if (direction === 'left') {
                    pos.x -= stepDistance;
                } else {
                    pos.x += stepDistance;
                }
                // 在最后一步时，实际移动的距离可能跟理想移动距离有误差
                // 所以获取最后一步移动之前，所需移动距离与已经移动的距离这两者的差
                // 然后设置最后一步移动的距离为计算之后的值
                let balance = realDistance - summaryDistance;
                if (parseFloat (balance) < parseFloat (stepDistance)) {
                    if (direction === 'left') {
                        pos.x -= parseFloat (balance);
                    } else {
                        pos.x += parseFloat (balance);
                    }
                    if (self.hasRa) {
                        cancelAnimationFrame(self.stepTimer);
                        self.stepTimer = null;
                    } else {
                        clearInterval(self.stepTimer);
                        self.stepTimer = null;
                    }
                } else {
                    if (self.hasRa) {
                        self.stepTimer = requestAnimationFrame(_stepFunc)
                    }
                }
                self.transformNow (pos.x);
            }
        },
        /**
         * 清除定时器
         */
        stop: function() {
            clearInterval(this.options.timer);
            this.timer = null;
        },
        /**
         * 移动动作
         * @param distance
         */
        transformNow: function(distance) {
            if(transform){
                this.options.container.style[transform]  = 'translate(' + distance + 'px, ' + '0px )'
            }else{
                this.options.container.style.left = distance + 'px';
            }
        },
        /**
         * 克隆元素及添加到文档中
         */
        copyNode: function(){
            let children = this.options.container.children;

            let length = children.length,
                firstNode = children[0].cloneNode(true);
            // this.container.insertBefore(lastNode, this.container.firstChild);
            this.options.container.appendChild(firstNode);
        },
        /**
         * 获取容器已经移动的距离
         * @returns {{x: number, y: number}}
         */
        getPosition: function(){
            let pos = {x: 0, y: 0};
            if (transform) {
                let transformValue = getStyle(this.options.container, 'transform');
                if (transformValue === 'none') {
                    this.options.container.style[transform] = 'translate(0, 0)';
                } else {
                    let temp = transformValue.match(/-?\d+/g);
                    pos = {
                        x: parseInt(temp[4].trim()),
                        y: parseInt(temp[5].trim())
                    }
                }
            } else {
                if (getStyle(this.options.container, 'position') === 'static') {
                    this.options.container.style.position = 'relative';
                } else {
                    pos = {
                        x: getStyle(this.options.container, 'left') ? getStyle(this.options.container, 'left') : 0,
                        y: getStyle(this.options.container, 'top') ? getStyle(this.options.container, 'top') : 0
                    }
                }
            }

            return pos;
        },
        /**
         * 添加事件监听
         */
        handleEvents: function() {

            let self = this;
            if (self.options.autoplay) {
                this.options.container.addEventListener('mouseover', function(){
                    self.stop();
                }, false);
                this.options.container.addEventListener('mouseout', function(){
                    self.options.timer = setInterval(function(){
                        self.move('left');
                    }, self.options.duration)
                }, false);
            }

            this.options.prev.addEventListener('click', function(){
                self.stop();
                self.move('right');
            }, false);
            this.options.next.addEventListener('click', function(){
                self.stop();
                self.move('left');
            }, false);

            // 给pagination绑定点击事件
            query('#pagination-wrapper').addEventListener('click', function (e) {

                let childrenPaginations = query('#pagination-wrapper').children;
                childrenPaginations = Array.prototype.slice.call(childrenPaginations, 0)
                let currntIndex = self.options.slideIndex;

                childrenPaginations.forEach((item, index) => {

                    if (e.target === item) {
                        let paginationIndex = Number(item.getAttribute('pagination-index'));

                        if (currntIndex < paginationIndex) {
                            // 在这里减1是因为方法_throttle中会在每次操作时对slideInde进行+1操作
                            // 所以为了保证正确的idnex， 这里需减1
                            self.options.slideIndex = paginationIndex - 1;
                            let coefficient = paginationIndex - currntIndex > 1 ? paginationIndex - currntIndex : 1;
                            self.stop();
                            self.move('left', coefficient);
                        } else if (currntIndex > paginationIndex) {
                            // 同上
                            self.options.slideIndex = paginationIndex + 1;
                            let coefficient = currntIndex - paginationIndex > 1 ? currntIndex - paginationIndex : 1;
                            self.stop();
                            self.move('right', coefficient);
                        }
                    }
                })
            })

            // todo 添加手势滑动

        }
    };

    /**
     * 节流
     * @param func  需要执行的方法
     * @param delay 限制的时间
     * @returns {Function}
     */
    function throttle (func, delay) {
        let oldTime = 0;
        return function(){
            let newTime = new Date();
            let args = [].slice.call(arguments);
            if(newTime - oldTime > delay){
                func.apply(this, args);
                oldTime = newTime;
            }
        }
    }
    /**
     * 简单选择器
     * 目前只支持 id class tag这三种
     * @param selector
     * @returns {*}
     * @constructor
     */
    function query(selector) {
        if (selector.indexOf('#') === 0) {
            return document.getElementById(selector.substring(1, selector.length))
        } else if (selector.indexOf('.') === 0) {
            return document.getElementsByClassName(selector.substring(1, selector.length))[0]
        } else {
            return document.getElementsByTagName(selector)
        }
    }

    /**
     * 判断是否有指定class
     * @param element
     * @param className
     * @returns {boolean}
     */
    function hasClassName (element, className) {
        let classNameArray = element.className.split(' ')
        if (classNameArray.indexOf(className) > -1) {
            return true
        }
        return false
    }

    /**
     * 添加class
     * @param element
     * @param className
     */
    function addClass (element, className) {
        if (!hasClassName(element, className)) {
            element.className += ' ' + className;
        }
    }

    /**
     * 移除class
     * @param element
     * @param className
     */
    function removeClass (element, className) {
        if (hasClassName(element, className)) {
            let classNameArray = element.className.split(' ');
            let index = classNameArray.indexOf(className);
            classNameArray.splice(index, 1)
            element.className = classNameArray.join(' ');
        }
    }

    /**
     * 获取样式属性值
     * @param elem 对象
     * @param property 属性
     * @returns {string}
     */
    function getStyle(elem, property){
        return document.defaultView.getComputedStyle ? document.defaultView.getComputedStyle(elem, false)[property] : elem.currentStyle[property];
    }

    /**
     * 获得transform格式
     * @returns {string}
     */
    function getTransform() {
        let transform = '',
            divStyle = document.createElement('div').style,
            transformArr = ['transform', 'webkitTransform', 'MozTransform', 'msTransform', 'OTransform'];

        for(let i = 0; i < transformArr.length; i++){
            if(transformArr[i] in divStyle){
                transform = transformArr[i];
                return transform;
            }
        }
        return transform;
    }

    /**
     * 简单合并2个对象
     * @param defaultOptions
     * @param newOptions
     * @returns {any} 返回合并之后的对象
     */
    function mergeObj(defaultOptions, newOptions={}) {
        Object.keys(defaultOptions).forEach(function(item, index) {
            if (item in newOptions) {
                defaultOptions[item] = newOptions[item];
            }
        })
        return defaultOptions;
    }
    window.Loop = Loop;
})();